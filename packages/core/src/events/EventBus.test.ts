import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './EventBus.js';

describe('EventBus', () => {
  it('publish한 이벤트를 subscribe한 리스너가 수신한다', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.publish({ type: 'role:start', role: 'pm', stepId: 'pm-1', stepLabel: 'PM' });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ type: 'role:start', role: 'pm', stepId: 'pm-1', stepLabel: 'PM' });
  });

  it('여러 리스너 모두 이벤트를 수신한다', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe(a);
    bus.subscribe(b);

    bus.publish({ type: 'role:complete', role: 'pm', stepId: 'pm-1', stepLabel: 'PM', summary: '완료' });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('unsubscribe 후에는 이벤트를 수신하지 않는다', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.subscribe(listener);
    bus.unsubscribe(listener);

    bus.publish({ type: 'role:start', role: 'architect', stepId: 'architect-1', stepLabel: 'Architect' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('모든 이벤트 타입을 올바르게 전달한다', () => {
    const bus = new EventBus();
    const received: string[] = [];
    bus.subscribe((e) => received.push(e.type));

    bus.publish({ type: 'role:start',       role: 'pm', stepId: 'pm-1', stepLabel: 'PM' });
    bus.publish({ type: 'llm:token',        token: 'hello' });
    bus.publish({ type: 'role:complete',    role: 'pm', stepId: 'pm-1', stepLabel: 'PM', summary: 'done' });
    bus.publish({ type: 'context:transfer', fromId: 'pm-1', fromLabel: 'PM', toId: 'architect-1', toLabel: 'Architect', length: 100, preview: '...' });
    bus.publish({ type: 'artifact:save',    role: 'pm', stepId: 'pm-1', filePath: 'docs/PRD.md', fileType: 'markdown' });

    expect(received).toEqual([
      'role:start',
      'llm:token',
      'role:complete',
      'context:transfer',
      'artifact:save',
    ]);
  });

  it('publish하지 않으면 리스너가 호출되지 않는다', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    expect(listener).not.toHaveBeenCalled();
  });
});
