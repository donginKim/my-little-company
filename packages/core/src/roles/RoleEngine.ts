import type { LLMRouter } from '../llm/LLMRouter.js';
import type { EventBus } from '../events/EventBus.js';
import type { LLMMessage, RoleName, RoleOutput, Artifact } from '../types/index.js';

export interface RoleConfig {
  llmOptions?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  stream?: boolean;
  /** 파이프라인 스텝 ID (예: "pm-1", "developer-2") */
  stepId?: string;
  /** 화면 표시 레이블 (예: "PM", "PM (1/2)") */
  stepLabel?: string;
  /** 같은 역할 내 몇 번째 인스턴스 (1-based). 1이면 첫 번째 */
  instanceIndex?: number;
  /** 같은 역할의 총 인스턴스 수 */
  totalInstances?: number;
  /** 사전 로드된 문서가 있을 때 true → PM이 검수 모드로 동작 */
  isDocReview?: boolean;
  /** developer 전용: 'code'(기본) | 'full'(의존성+스크립트 포함) */
  mode?: 'code' | 'full';
}

/**
 * BaseRole: 모든 AI 역할의 기반 클래스
 *
 * execute() 흐름:
 *   role:start → llm:request → llm:token* → llm:response → role:complete
 */
export abstract class BaseRole {
  protected router: LLMRouter;
  protected config: RoleConfig;
  protected bus?: EventBus;
  abstract readonly roleName: RoleName;

  constructor(router: LLMRouter, config: RoleConfig = {}, bus?: EventBus) {
    this.router = router;
    this.config = config;
    this.bus = bus;
  }

  protected abstract buildSystemPrompt(): string;
  protected abstract buildUserPrompt(context: string): string;
  protected abstract parseOutput(rawContent: string): Artifact[];

  async execute(context: string, signal?: AbortSignal): Promise<RoleOutput> {
    const stepId = this.config.stepId ?? this.roleName;
    const stepLabel = this.config.stepLabel ?? this.roleName.toUpperCase();

    this.bus?.publish({ type: 'role:start', role: this.roleName, stepId, stepLabel });

    const messages: LLMMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user',   content: this.buildUserPrompt(context) },
    ];

    const callOptions = {
      ...this.config.llmOptions,
      role: this.roleName,
      stepId,
      signal,
    };

    let content: string;
    const useStream = this.config.stream !== false;

    try {
      if (useStream) {
        content = await this.collectStream(messages, callOptions);
      } else {
        const response = await this.router.complete(messages, callOptions);
        content = response.content;
      }
    } catch (err) {
      this.bus?.publish({ type: 'role:error', role: this.roleName, stepId, error: String(err) });
      throw err;
    }

    const artifacts = this.parseOutput(content);

    for (const artifact of artifacts) {
      this.bus?.publish({
        type: 'artifact:save',
        role: this.roleName,
        stepId,
        filePath: artifact.path,
        fileType: artifact.type,
      });
    }

    const output: RoleOutput = {
      role: this.roleName,
      artifacts,
      summary: this.extractSummary(content),
      metadata: {
        timestamp: new Date().toISOString(),
        model: this.config.llmOptions?.model ?? 'default',
        provider: this.config.llmOptions?.provider ?? 'default',
      },
    };

    this.bus?.publish({
      type: 'role:complete',
      role: this.roleName,
      stepId,
      stepLabel,
      summary: output.summary,
    });

    return output;
  }

  private async collectStream(messages: LLMMessage[], options: any): Promise<string> {
    let full = '';
    for await (const token of this.router.completeStream(messages, options)) {
      full += token;
    }
    return full;
  }

  protected extractSummary(content: string): string {
    const firstPara = content.split('\n\n')[0] ?? content.slice(0, 200);
    return firstPara.replace(/^#+\s+/gm, '').trim();
  }

  protected extractJson<T>(content: string, fallback: T): T {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
      try { return JSON.parse(match[1].trim()) as T; } catch { /* ignore */ }
    }
    try { return JSON.parse(content) as T; } catch { return fallback; }
  }
}
