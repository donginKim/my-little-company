import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMRouter } from './LLMRouter.js';
import { EventBus } from '../events/EventBus.js';
import type { ILLMProvider, LLMMessage, LLMOptions, LLMResponse } from '../types/index.js';

// 테스트용 Mock 프로바이더
function makeMockProvider(name: string, response = 'mock response'): ILLMProvider {
  return {
    name,
    defaultModel: `${name}-default`,
    complete: vi.fn().mockResolvedValue({
      content: response,
      model: `${name}-default`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    } satisfies LLMResponse),
    async *completeStream(_msgs: LLMMessage[], _opts?: LLMOptions) {
      const words = response.split(' ');
      for (const w of words) yield w + ' ';
    },
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

describe('LLMRouter', () => {
  let router: LLMRouter;
  let mockA: ILLMProvider;
  let mockB: ILLMProvider;

  beforeEach(() => {
    mockA = makeMockProvider('provider-a', 'response from A');
    mockB = makeMockProvider('provider-b', 'response from B');

    router = new LLMRouter({
      defaultProvider: 'provider-a',
      providers: {},
    });
    router.register('provider-a', mockA);
    router.register('provider-b', mockB);
  });

  it('기본 프로바이더로 complete를 호출한다', async () => {
    const res = await router.complete([{ role: 'user', content: 'hello' }]);
    expect(res.content).toBe('response from A');
    expect(mockA.complete).toHaveBeenCalledOnce();
    expect(mockB.complete).not.toHaveBeenCalled();
  });

  it('options.provider로 특정 프로바이더를 지정할 수 있다', async () => {
    const res = await router.complete(
      [{ role: 'user', content: 'hello' }],
      { provider: 'provider-b' }
    );
    expect(res.content).toBe('response from B');
    expect(mockA.complete).not.toHaveBeenCalled();
  });

  it('setDefault로 기본 프로바이더를 변경한다', async () => {
    router.setDefault('provider-b');
    const res = await router.complete([{ role: 'user', content: 'hello' }]);
    expect(res.content).toBe('response from B');
  });

  it('존재하지 않는 프로바이더 요청 시 오류를 던진다', async () => {
    await expect(
      router.complete([{ role: 'user', content: 'x' }], { provider: 'does-not-exist' })
    ).rejects.toThrow("'does-not-exist'");
  });

  it('setDefault에 미등록 프로바이더를 지정하면 오류를 던진다', () => {
    expect(() => router.setDefault('ghost')).toThrow("'ghost'");
  });

  it('listRegistered는 등록된 프로바이더 이름 목록을 반환한다', () => {
    expect(router.listRegistered()).toEqual(
      expect.arrayContaining(['provider-a', 'provider-b'])
    );
  });

  it('listAvailable은 isAvailable()이 true인 프로바이더만 반환한다', async () => {
    (mockB.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const available = await router.listAvailable();
    expect(available).toContain('provider-a');
    expect(available).not.toContain('provider-b');
  });

  it('completeStream은 토큰을 순서대로 yield한다', async () => {
    const tokens: string[] = [];
    for await (const t of router.completeStream([{ role: 'user', content: 'hi' }])) {
      tokens.push(t);
    }
    expect(tokens.join('')).toContain('response from A');
  });

  it('completeStream은 EventBus에 llm:request, llm:token, llm:response를 발행한다', async () => {
    const bus = new EventBus();
    const events: string[] = [];
    bus.subscribe((e) => events.push(e.type));

    const routerWithBus = new LLMRouter({ defaultProvider: 'provider-a', providers: {} }, bus);
    routerWithBus.register('provider-a', mockA);

    for await (const _ of routerWithBus.completeStream(
      [{ role: 'user', content: 'hi' }],
      { role: 'pm' }
    )) { /* consume */ }

    expect(events).toContain('llm:request');
    expect(events).toContain('llm:token');
    expect(events).toContain('llm:response');
  });

  it('complete는 EventBus에 llm:request, llm:response를 발행한다', async () => {
    const bus = new EventBus();
    const types: string[] = [];
    bus.subscribe((e) => types.push(e.type));

    const routerWithBus = new LLMRouter({ defaultProvider: 'provider-a', providers: {} }, bus);
    routerWithBus.register('provider-a', mockA);

    await routerWithBus.complete([{ role: 'user', content: 'hi' }], { role: 'pm' });

    expect(types).toContain('llm:request');
    expect(types).toContain('llm:response');
    expect(types).not.toContain('llm:token');
  });
});
