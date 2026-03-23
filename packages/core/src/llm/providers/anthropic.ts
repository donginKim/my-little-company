import type { ILLMProvider, LLMMessage, LLMOptions, LLMResponse, ProviderConfig } from '../../types/index.js';

export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-sonnet-4-6';

  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const client = await this.createClient();
    const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;
    const { systemPrompt, userMessages } = this.splitMessages(messages);

    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: userMessages,
    });

    const content = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    return {
      content,
      model,
      usage: {
        promptTokens: response.usage?.input_tokens ?? 0,
        completionTokens: response.usage?.output_tokens ?? 0,
        totalTokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      },
    };
  }

  async *completeStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const client = await this.createClient();
    const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;
    const { systemPrompt, userMessages } = this.splitMessages(messages);

    const stream = await client.messages.stream({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: userMessages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await import('@anthropic-ai/sdk');
      return !!(this.config.apiKey ?? process.env.ANTHROPIC_API_KEY);
    } catch {
      return false;
    }
  }

  private async createClient(): Promise<any> {
    let Anthropic: any;
    try {
      const mod = await import('@anthropic-ai/sdk');
      Anthropic = mod.default;
    } catch {
      throw new Error('@anthropic-ai/sdk 패키지가 설치되지 않았습니다. npm install @anthropic-ai/sdk 를 실행하세요.');
    }
    return new Anthropic({
      apiKey: this.config.apiKey ?? process.env.ANTHROPIC_API_KEY,
      ...(this.config.baseUrl ? { baseURL: this.config.baseUrl } : {}),
    });
  }

  private splitMessages(messages: LLMMessage[]): {
    systemPrompt: string;
    userMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const systemPrompt = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return { systemPrompt, userMessages };
  }
}
