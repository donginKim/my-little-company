import type { ILLMProvider, LLMMessage, LLMOptions, LLMResponse, ProviderConfig } from '../../types/index.js';

export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o';

  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const client = await this.createClient();
    const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;

    const response = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    return {
      content: response.choices[0]?.message?.content ?? '',
      model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  async *completeStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const client = await this.createClient();
    const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;

    const stream = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await import('openai');
      return !!(this.config.apiKey ?? process.env.OPENAI_API_KEY);
    } catch {
      return false;
    }
  }

  private async createClient(): Promise<any> {
    let OpenAI: any;
    try {
      const mod = await import('openai');
      OpenAI = mod.default;
    } catch {
      throw new Error('openai 패키지가 설치되지 않았습니다. npm install openai 를 실행하세요.');
    }
    return new OpenAI({
      apiKey: this.config.apiKey ?? process.env.OPENAI_API_KEY,
      ...(this.config.baseUrl ? { baseURL: this.config.baseUrl } : {}),
    });
  }
}
