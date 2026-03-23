import type { ILLMProvider, LLMMessage, LLMOptions, LLMResponse, ProviderConfig } from '../../types/index.js';

export class OllamaProvider implements ILLMProvider {
  readonly name = 'ollama';
  readonly defaultModel = 'llama3';

  private baseUrl: string;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
  }

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
        },
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 오류 (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    return {
      content: data.message?.content ?? '',
      model,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    };
  }

  async *completeStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
        },
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama 스트리밍 오류 (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const token = data.message?.content;
          if (token) yield token;
        } catch {
          // 파싱 실패 무시
        }
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
