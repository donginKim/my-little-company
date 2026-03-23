import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { LLMRouterConfig, PipelineStep, ResolvedPipelineStep, RoleName } from '@mlc/core';

// ──────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────

export interface MlcConfig {
  llm: LLMRouterConfig;
  /** pipeline 배열: 실행 순서와 역할별 설정을 정의 */
  pipeline?: PipelineStep[];
  safeMode?: boolean;
}

// ──────────────────────────────────────────────
// 기본 파이프라인
// ──────────────────────────────────────────────

const DEFAULT_PIPELINE: PipelineStep[] = [
  { role: 'pm',        temperature: 0.8, maxTokens: 4096 },
  { role: 'architect', temperature: 0.3, maxTokens: 8192 },
  { role: 'developer', temperature: 0.2, maxTokens: 8192 },
  { role: 'reviewer',  temperature: 0.5, maxTokens: 4096 },
];

const DEFAULT_CONFIG: MlcConfig = {
  llm: {
    defaultProvider: 'anthropic',
    providers: {
      anthropic: { type: 'anthropic' },
      openai:    { type: 'openai' },
      ollama:    { type: 'ollama', baseUrl: 'http://localhost:11434' },
    },
  },
  pipeline: DEFAULT_PIPELINE,
  safeMode: false,
};

// ──────────────────────────────────────────────
// 파이프라인 스텝 ID/레이블 자동 부여
// ──────────────────────────────────────────────

/**
 * PipelineStep 배열을 받아 ResolvedPipelineStep 배열로 변환한다.
 * 같은 역할이 여러 번 등장하면 "pm-1", "pm-2" 형태의 ID를 부여하고,
 * 중복이 있으면 레이블을 "PM (1/2)"처럼 표시한다.
 */
export function resolvePipeline(steps: PipelineStep[]): ResolvedPipelineStep[] {
  // 역할별 총 등장 횟수
  const totals: Partial<Record<RoleName, number>> = {};
  for (const s of steps) {
    totals[s.role] = (totals[s.role] ?? 0) + 1;
  }

  const counters: Partial<Record<RoleName, number>> = {};
  const roleNameMap: Record<RoleName, string> = {
    pm: 'PM',
    architect: 'Architect',
    developer: 'Developer',
    reviewer: 'Reviewer',
    qa: 'QA',
  };

  return steps.map((step) => {
    counters[step.role] = (counters[step.role] ?? 0) + 1;
    const idx = counters[step.role]!;
    const total = totals[step.role]!;
    const id = `${step.role}-${idx}`;
    const baseName = roleNameMap[step.role];
    const label = total > 1 ? `${baseName} (${idx}/${total})` : baseName;
    return { ...step, id, label, instanceIndex: idx, totalInstances: total };
  });
}

// ──────────────────────────────────────────────
// 로더
// ──────────────────────────────────────────────

export async function loadConfig(projectPath?: string): Promise<MlcConfig> {
  const home = process.env.HOME ?? '~';
  const base = projectPath ?? process.cwd();

  const candidates = [
    path.join(base, 'mlc.config.yaml'),
    path.join(base, 'mlc.config.yml'),
    path.join(base, 'mlc.config.json'),
    path.join(home, '.mlc', 'config.yaml'),
    path.join(home, '.mlc', 'config.json'),
  ];

  for (const filePath of candidates) {
    const raw = await tryRead(filePath);
    if (raw === null) continue;

    const interpolated = interpolateEnv(raw);
    const parsed = parseFile(filePath, interpolated);
    if (parsed) return mergeConfig(DEFAULT_CONFIG, parsed);
  }

  return autoConfig();
}

export async function writeDefaultYaml(projectPath: string): Promise<void> {
  const filePath = path.join(projectPath, 'mlc.config.yaml');
  await fs.writeFile(filePath, EXAMPLE_YAML, 'utf-8');
}

export async function writeDefaultConfig(projectPath: string): Promise<void> {
  await writeDefaultYaml(projectPath);
}

// ──────────────────────────────────────────────
// 내부 유틸
// ──────────────────────────────────────────────

async function tryRead(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function parseFile(filePath: string, content: string): Partial<MlcConfig> | null {
  try {
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return yaml.load(content) as Partial<MlcConfig>;
    }
    return JSON.parse(content) as Partial<MlcConfig>;
  } catch (err) {
    console.error(`설정 파일 파싱 오류 (${filePath}): ${err}`);
    return null;
  }
}

function interpolateEnv(content: string): string {
  return content.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g, (_, braced, bare) => {
    const key = braced ?? bare;
    return process.env[key] ?? '';
  });
}

function autoConfig(): MlcConfig {
  const defaultProvider =
    process.env.MLC_DEFAULT_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY ? 'anthropic' :
     process.env.OPENAI_API_KEY    ? 'openai'    : 'ollama');

  return {
    ...DEFAULT_CONFIG,
    llm: { ...DEFAULT_CONFIG.llm, defaultProvider },
  };
}

function mergeConfig(base: MlcConfig, override: Partial<MlcConfig>): MlcConfig {
  // pipeline: override가 있으면 사용, 없으면 base 사용
  const pipeline = override.pipeline ?? base.pipeline ?? DEFAULT_PIPELINE;

  return {
    safeMode: override.safeMode ?? base.safeMode,
    llm: {
      defaultProvider:
        override.llm?.defaultProvider ?? base.llm.defaultProvider,
      providers: {
        ...base.llm.providers,
        ...(override.llm?.providers ?? {}),
      },
    },
    pipeline,
  };
}

// ──────────────────────────────────────────────
// 예시 YAML
// ──────────────────────────────────────────────

const EXAMPLE_YAML = `# mlc.config.yaml
# My Little Company 설정 파일
# 환경변수는 \${VAR_NAME} 형식으로 참조합니다.

llm:
  # 역할에서 provider를 지정하지 않으면 이 프로바이더를 사용합니다.
  defaultProvider: anthropic

  providers:
    anthropic:
      type: anthropic
      apiKey: \${ANTHROPIC_API_KEY}
      defaultModel: claude-sonnet-4-6

    openai:
      type: openai
      apiKey: \${OPENAI_API_KEY}
      defaultModel: gpt-4o

    openai-mini:
      type: openai
      apiKey: \${OPENAI_API_KEY}
      defaultModel: gpt-4o-mini

    ollama:
      type: ollama
      baseUrl: http://localhost:11434
      defaultModel: llama3

    ollama-code:
      type: ollama
      baseUrl: http://localhost:11434
      defaultModel: codellama

# pipeline: 실행할 역할을 순서대로 나열합니다.
# 같은 역할을 여러 번 써도 됩니다 (예: pm 2번).
# role: pm | architect | developer | reviewer
# provider, model, temperature, maxTokens는 각 스텝마다 개별 설정 가능.
pipeline:
  - role: pm
    provider: anthropic
    model: claude-sonnet-4-6
    temperature: 0.8      # 창의적인 기획을 위해 높게
    maxTokens: 4096

  - role: architect
    provider: openai
    model: gpt-4o
    temperature: 0.3      # 정확한 설계를 위해 낮게
    maxTokens: 8192

  - role: developer
    provider: ollama-code
    model: codellama
    temperature: 0.2      # 코드는 정확성 최우선
    maxTokens: 8192

  - role: reviewer
    provider: anthropic
    model: claude-sonnet-4-6
    temperature: 0.5
    maxTokens: 4096

# true로 설정하면 파일을 실제로 쓰지 않습니다 (미리보기만)
safeMode: false
`;
