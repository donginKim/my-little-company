// ============================================================
// LLM Provider Types
// ============================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** 모든 LLM 프로바이더가 구현해야 하는 인터페이스 */
export interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  /** 스트리밍 지원 (선택적) - 토큰 단위로 yield */
  completeStream?(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}

export interface LLMRouterConfig {
  defaultProvider: string;
  providers: Record<string, ProviderConfig>;
}

export interface ProviderConfig {
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

// ============================================================
// Role Types
// ============================================================

export type RoleName = 'pm' | 'architect' | 'developer' | 'reviewer' | 'qa';

/** 역할별 LLM 할당 및 파라미터 설정 (하위 호환용) */
export interface RoleSettings {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export type RoleSettingsMap = Partial<Record<RoleName, RoleSettings>>;

// ============================================================
// Pipeline Types
// ============================================================

/** YAML pipeline 배열의 항목 하나 */
export interface PipelineStep {
  role: RoleName;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * developer 전용 출력 모드:
   * - 'code'  (기본) : 소스 파일만
   * - 'full'        : 소스 + 의존성 파일(package.json 등) + 실행 스크립트 + README setup
   */
  mode?: 'code' | 'full';
}

/** ID와 표시 레이블이 부여된 실행 가능한 스텝 */
export interface ResolvedPipelineStep extends PipelineStep {
  /** 자동 생성: "pm-1", "pm-2", "architect-1" 등 */
  id: string;
  /** 화면 표시용: "PM", "PM (1/2)", "Architect" 등 */
  label: string;
  /** 같은 역할 내 몇 번째 인스턴스인지 (1-based) */
  instanceIndex: number;
  /** 파이프라인에서 같은 역할의 총 인스턴스 수 */
  totalInstances: number;
}

// ============================================================
// Artifact / Role Output
// ============================================================

export interface Artifact {
  type: 'markdown' | 'json' | 'code';
  path: string;
  content: string;
}

export interface RoleOutput {
  role: RoleName;
  artifacts: Artifact[];
  summary: string;
  metadata: {
    timestamp: string;
    model: string;
    provider: string;
  };
}

// ============================================================
// Workflow Types
// ============================================================

export interface WorkflowState {
  projectName: string;
  projectPath: string;
  idea: string;
  /** 사전 로드된 문서 목록 (mlc plan --file 로 로드) */
  preloadedDocs?: Array<{ name: string; content: string }>;
  /** 완료된 스텝 ID 목록 (실행 순서 보장) */
  completedStepIds: string[];
  /** stepId → RoleOutput */
  outputs: Record<string, RoleOutput>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// File System Types
// ============================================================

export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  content?: string;
  diff?: string;
}

export interface ApplyResult {
  applied: string[];
  skipped: string[];
  errors: Array<{ path: string; error: string }>;
}

// ============================================================
// Task Types (Architect output)
// ============================================================

export interface Task {
  id: string;
  title: string;
  description: string;
  role: RoleName;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
  artifacts?: string[];
}

export interface TaskList {
  version: string;
  projectName: string;
  tasks: Task[];
}
