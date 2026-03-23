import type {
  ILLMProvider,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  LLMRouterConfig,
  ProviderConfig,
  RoleName,
} from '../types/index.js';
import type { EventBus } from '../events/EventBus.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';

export interface RouterCallOptions extends LLMOptions {
  provider?: string;
  role?: RoleName;
  stepId?: string;
  signal?: AbortSignal;
}

export class LLMRouter {
  private providers = new Map<string, ILLMProvider>();
  private defaultProvider: string;
  private bus?: EventBus;

  constructor(config: LLMRouterConfig, bus?: EventBus) {
    this.defaultProvider = config.defaultProvider;
    this.bus = bus;
    this.registerBuiltinProviders(config.providers);
  }

  setEventBus(bus: EventBus): void {
    this.bus = bus;
  }

  register(name: string, provider: ILLMProvider): void {
    this.providers.set(name, provider);
  }

  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`프로바이더 '${name}'이 등록되지 않았습니다.`);
    }
    this.defaultProvider = name;
  }

  async complete(messages: LLMMessage[], options?: RouterCallOptions): Promise<LLMResponse> {
    const { providerName, provider } = this.resolveProvider(options?.provider);
    const role = options?.role ?? ('unknown' as RoleName);
    const stepId = options?.stepId ?? role;

    this.bus?.publish({
      type: 'llm:request',
      role,
      stepId,
      provider: providerName,
      model: options?.model ?? provider.defaultModel,
    });

    const response = await provider.complete(messages, options);

    this.bus?.publish({ type: 'llm:response', usage: response.usage });

    return response;
  }

  async *completeStream(
    messages: LLMMessage[],
    options?: RouterCallOptions
  ): AsyncGenerator<string> {
    const { providerName, provider } = this.resolveProvider(options?.provider);
    const role = options?.role ?? ('unknown' as RoleName);
    const stepId = options?.stepId ?? role;

    this.bus?.publish({
      type: 'llm:request',
      role,
      stepId,
      provider: providerName,
      model: options?.model ?? provider.defaultModel,
    });

    let fullContent = '';
    const signal = options?.signal;

    if (provider.completeStream) {
      for await (const token of provider.completeStream(messages, options)) {
        if (signal?.aborted) break;
        fullContent += token;
        this.bus?.publish({ type: 'llm:token', token });
        yield token;
      }
    } else {
      const response = await provider.complete(messages, options);
      fullContent = response.content;
      this.bus?.publish({ type: 'llm:token', token: response.content });
      yield response.content;
    }

    this.bus?.publish({ type: 'llm:response', usage: undefined });
  }

  async listAvailable(): Promise<string[]> {
    const results: string[] = [];
    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) results.push(name);
    }
    return results;
  }

  listRegistered(): string[] {
    return [...this.providers.keys()];
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  private resolveProvider(name?: string): { providerName: string; provider: ILLMProvider } {
    const providerName = name ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(
        `프로바이더 '${providerName}'을 찾을 수 없습니다. 등록된 프로바이더: ${[...this.providers.keys()].join(', ')}`
      );
    }
    return { providerName, provider };
  }

  private registerBuiltinProviders(configs: Record<string, ProviderConfig>): void {
    for (const [name, config] of Object.entries(configs)) {
      const provider = this.createProvider(config);
      if (provider) this.providers.set(name, provider);
    }
  }

  private createProvider(config: ProviderConfig): ILLMProvider | null {
    switch (config.type) {
      case 'openai':    return new OpenAIProvider(config);
      case 'anthropic': return new AnthropicProvider(config);
      case 'ollama':    return new OllamaProvider(config);
      default:          return null;
    }
  }
}

export function createLLMRouterFromConfig(config: LLMRouterConfig, bus?: EventBus): LLMRouter {
  return new LLMRouter(config, bus);
}

export function createAutoLLMRouter(bus?: EventBus): LLMRouter {
  const providers: Record<string, ProviderConfig> = {};
  if (process.env.OPENAI_API_KEY)    providers['openai']    = { type: 'openai' };
  if (process.env.ANTHROPIC_API_KEY) providers['anthropic'] = { type: 'anthropic' };
  providers['ollama'] = { type: 'ollama' };

  const defaultProvider =
    process.env.MLC_DEFAULT_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : 'ollama');

  return new LLMRouter({ defaultProvider, providers }, bus);
}
