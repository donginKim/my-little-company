import type { Artifact, TaskList } from '../types/index.js';
import { BaseRole } from './RoleEngine.js';

/**
 * ArchitectRole: PRD를 받아 architecture.md + tasks.json 생성
 */
export class ArchitectRole extends BaseRole {
  readonly roleName = 'architect' as const;

  protected buildSystemPrompt(): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `당신은 시니어 소프트웨어 아키텍트입니다.
이전 아키텍트가 설계한 아키텍처 초안이 컨텍스트에 포함되어 있습니다. 당신의 역할은 토론 파트너입니다.

진행 방식:
1. 이전 아키텍트의 기술 스택 선택, 구조 설계, 태스크 분해에 대해 동의/반대 의견을 제시하세요
2. 더 나은 대안이 있다면 구체적인 이유와 함께 제안하세요
3. 토론을 통해 합의된 최종 아키텍처와 태스크를 아래 형식으로 출력하세요

출력 형식:
## 이전 아키텍트 검토
(동의/반대/보완 의견)

\`\`\`markdown:docs/architecture.md
(최종 합의된 아키텍처 문서)
\`\`\`

\`\`\`json:tasks.json
{ "version": "1.0", "projectName": "...", "tasks": [...] }
\`\`\``;
    }

    return `당신은 시니어 소프트웨어 아키텍트입니다.
PRD를 바탕으로 시스템 아키텍처를 설계하고 구체적인 개발 태스크를 생성하세요.

출력 형식:
두 개의 코드 블록을 반드시 포함해야 합니다:

1. \`\`\`markdown:docs/architecture.md
   - 시스템 개요
   - 기술 스택 (선택 이유 포함)
   - 디렉터리 구조
   - 핵심 모듈 설명
   - 데이터 흐름
   - API 설계 (해당하는 경우)
   \`\`\`

2. \`\`\`json:tasks.json
   {
     "version": "1.0",
     "projectName": "...",
     "tasks": [
       {
         "id": "task-001",
         "title": "...",
         "description": "...",
         "role": "developer",
         "dependencies": [],
         "status": "pending",
         "artifacts": ["src/..."]
       }
     ]
   }
   \`\`\`

태스크는 독립적이고 구체적으로 작성하세요. 각 태스크는 하나의 집중된 작업이어야 합니다.

태스크 목록에 반드시 다음을 포함하세요:
- task-000: 프로젝트 설정 태스크 — package.json(또는 해당 언어의 의존성 파일), .env.example, Dockerfile/docker-compose.yml, Makefile 또는 실행 스크립트, README.md 설치/실행 섹션
  예시: { "id": "task-000", "title": "프로젝트 설정 및 의존성", "description": "package.json, .env.example, Dockerfile, README 설치/실행 섹션 작성", "role": "developer", "dependencies": [], "status": "pending", "artifacts": ["package.json", ".env.example", "Dockerfile", "README.md"] }`;
  }

  protected buildUserPrompt(context: string): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `아래 컨텍스트에는 이전 아키텍트의 설계가 포함되어 있습니다.
이전 설계를 비판적으로 검토하고 토론을 통해 최종 아키텍처와 태스크 목록을 완성해주세요.

${context}`;
    }

    return `다음 프로젝트 컨텍스트를 바탕으로 시스템 아키텍처와 태스크 목록을 생성해주세요:

${context}

현실적이고 구현 가능한 설계를 해주세요.`;
  }

  protected parseOutput(rawContent: string): Artifact[] {
    const artifacts: Artifact[] = [];

    // architecture.md 추출
    const archMatch = rawContent.match(
      /```(?:markdown:docs\/architecture\.md|markdown)\s*([\s\S]*?)```/
    );
    if (archMatch?.[1]) {
      artifacts.push({
        type: 'markdown',
        path: 'docs/architecture.md',
        content: archMatch[1].trim(),
      });
    } else {
      // 폴백: 전체 내용에서 JSON 블록 제외
      const withoutJson = rawContent.replace(/```json[\s\S]*?```/g, '').trim();
      artifacts.push({
        type: 'markdown',
        path: 'docs/architecture.md',
        content: withoutJson,
      });
    }

    // tasks.json 추출
    const tasksMatch = rawContent.match(/```(?:json:tasks\.json|json)\s*([\s\S]*?)```/);
    if (tasksMatch?.[1]) {
      const taskList = this.extractJson<TaskList>(tasksMatch[1], {
        version: '1.0',
        projectName: 'unknown',
        tasks: [],
      });
      artifacts.push({
        type: 'json',
        path: '.mlc/tasks.json',
        content: JSON.stringify(taskList, null, 2),
      });
    }

    return artifacts;
  }
}
