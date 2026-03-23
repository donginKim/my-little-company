import { describe, it, expect, vi } from 'vitest';
import { PMRole } from './PMRole.js';
import { ArchitectRole } from './ArchitectRole.js';
import { DeveloperRole } from './DeveloperRole.js';
import { ReviewerRole } from './ReviewerRole.js';
import { LLMRouter } from '../llm/LLMRouter.js';
import type { ILLMProvider } from '../types/index.js';

function makeRouter(responseText: string): LLMRouter {
  const provider: ILLMProvider = {
    name: 'mock',
    defaultModel: 'mock-model',
    complete: vi.fn().mockResolvedValue({
      content: responseText,
      model: 'mock-model',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }),
    async *completeStream() { yield responseText; },
    isAvailable: vi.fn().mockResolvedValue(true),
  };
  const router = new LLMRouter({ defaultProvider: 'mock', providers: {} });
  router.register('mock', provider);
  return router;
}

// ──────────────────────────────────────────────
// PMRole
// ──────────────────────────────────────────────

describe('PMRole', () => {
  it('PRD.md 아티팩트를 생성한다', async () => {
    const prd = '# PRD\n\n## 개요\n투두 앱입니다.';
    const role = new PMRole(makeRouter(prd), { stream: false });
    const output = await role.execute('투두 앱 아이디어');

    expect(output.role).toBe('pm');
    expect(output.artifacts).toHaveLength(1);
    expect(output.artifacts[0].path).toBe('docs/PRD.md');
    expect(output.artifacts[0].type).toBe('markdown');
    expect(output.artifacts[0].content).toContain('# PRD');
  });

  it('summary는 응답 첫 단락을 기반으로 한다', async () => {
    const role = new PMRole(makeRouter('## 개요\n앱 설명'), { stream: false });
    const output = await role.execute('아이디어');
    expect(output.summary).toBeTruthy();
    expect(output.summary.length).toBeGreaterThan(0);
  });

  it('metadata에 타임스탬프가 포함된다', async () => {
    const role = new PMRole(makeRouter('# PRD'), { stream: false });
    const output = await role.execute('아이디어');
    expect(output.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ──────────────────────────────────────────────
// ArchitectRole
// ──────────────────────────────────────────────

describe('ArchitectRole', () => {
  const ARCH_RESPONSE = `
시스템 아키텍처입니다.

\`\`\`markdown
# Architecture

## 기술 스택
- React + TypeScript
- Node.js
\`\`\`

\`\`\`json
{
  "version": "1.0",
  "projectName": "todo-app",
  "tasks": [
    {
      "id": "task-001",
      "title": "TodoList 컴포넌트 구현",
      "description": "기본 리스트 UI 구현",
      "role": "developer",
      "dependencies": [],
      "status": "pending"
    }
  ]
}
\`\`\`
  `.trim();

  it('architecture.md와 tasks.json 아티팩트를 생성한다', async () => {
    const role = new ArchitectRole(makeRouter(ARCH_RESPONSE), { stream: false });
    const output = await role.execute('PRD 내용');

    const paths = output.artifacts.map((a) => a.path);
    expect(paths).toContain('docs/architecture.md');
    expect(paths).toContain('.mlc/tasks.json');
  });

  it('tasks.json 아티팩트는 유효한 JSON이다', async () => {
    const role = new ArchitectRole(makeRouter(ARCH_RESPONSE), { stream: false });
    const output = await role.execute('PRD 내용');

    const tasksArtifact = output.artifacts.find((a) => a.path === '.mlc/tasks.json');
    expect(tasksArtifact).toBeDefined();

    const parsed = JSON.parse(tasksArtifact!.content);
    expect(parsed.tasks).toBeInstanceOf(Array);
    expect(parsed.tasks[0].id).toBe('task-001');
  });

  it('JSON 블록이 없어도 architecture.md는 생성된다', async () => {
    const noJson = '# Architecture\n\n## 스택\nReact';
    const role = new ArchitectRole(makeRouter(noJson), { stream: false });
    const output = await role.execute('PRD');

    const arch = output.artifacts.find((a) => a.path === 'docs/architecture.md');
    expect(arch).toBeDefined();
    expect(arch!.content).toContain('Architecture');
  });
});

// ──────────────────────────────────────────────
// DeveloperRole
// ──────────────────────────────────────────────

describe('DeveloperRole', () => {
  const CODE_RESPONSE = `
코드를 작성하겠습니다.

\`\`\`typescript:src/components/TodoList.tsx
import React from 'react';

export function TodoList() {
  return <div>Todo</div>;
}
\`\`\`

\`\`\`typescript:src/types.ts
export interface Todo {
  id: string;
  title: string;
  done: boolean;
}
\`\`\`
  `.trim();

  it('lang:path 형식으로 여러 코드 파일을 파싱한다', async () => {
    const role = new DeveloperRole(makeRouter(CODE_RESPONSE), { stream: false });
    const output = await role.execute('아키텍처 내용');

    expect(output.artifacts).toHaveLength(2);
    expect(output.artifacts[0].path).toBe('src/components/TodoList.tsx');
    expect(output.artifacts[1].path).toBe('src/types.ts');
    expect(output.artifacts[0].type).toBe('code');
  });

  it('태스크가 설정된 경우 아티팩트 경로를 폴백으로 사용한다', async () => {
    const role = new DeveloperRole(makeRouter('코드 내용 (블록 없음)'), { stream: false });
    role.setTask({
      id: 'task-001',
      title: '구현',
      description: '...',
      role: 'developer',
      dependencies: [],
      status: 'pending',
      artifacts: ['src/index.ts'],
    });

    const output = await role.execute('컨텍스트');
    expect(output.artifacts[0].path).toBe('src/index.ts');
  });
});

// ──────────────────────────────────────────────
// ReviewerRole
// ──────────────────────────────────────────────

describe('ReviewerRole', () => {
  const REVIEW_RESPONSE = `
\`\`\`markdown
# 코드 리뷰 보고서

## 요약
전반적으로 양호합니다.

## 이슈
### 🔴 Critical
없음

### 🟡 Warning
- 에러 처리 추가 필요

## 긍정적인 점
- 코드 구조가 명확합니다
\`\`\`
  `.trim();

  it('review.md 아티팩트를 생성한다', async () => {
    const role = new ReviewerRole(makeRouter(REVIEW_RESPONSE), { stream: false });
    const output = await role.execute('코드 내용');

    expect(output.artifacts).toHaveLength(1);
    expect(output.artifacts[0].path).toBe('docs/review.md');
    expect(output.artifacts[0].content).toContain('코드 리뷰 보고서');
  });

  it('마크다운 블록이 없으면 전체 응답을 review.md로 저장한다', async () => {
    const raw = '# 리뷰\n문제 없음';
    const role = new ReviewerRole(makeRouter(raw), { stream: false });
    const output = await role.execute('코드');

    expect(output.artifacts[0].content).toContain('# 리뷰');
  });
});
