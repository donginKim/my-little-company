import type { Artifact } from '../types/index.js';
import { BaseRole } from './RoleEngine.js';

/**
 * QARole: PRD, 아키텍처, 코드를 바탕으로 QA 검증 보고서 생성
 */
export class QARole extends BaseRole {
  readonly roleName = 'qa' as const;

  protected buildSystemPrompt(): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `당신은 시니어 QA 엔지니어입니다.
이전 QA 엔지니어의 검증 보고서가 컨텍스트에 포함되어 있습니다.

진행 방식:
1. 이전 QA가 놓친 테스트 케이스나 관점을 추가하세요
2. 두 QA의 결과를 합쳐 최종 통합 QA 보고서를 작성하세요

출력 형식:
\`\`\`markdown:docs/qa-report.md
# QA 검증 보고서 (통합)
## 검증 요약
## 테스트 케이스
## 발견된 이슈
### 🔴 Critical
### 🟡 Warning
### 🟢 Minor
## 요구사항 충족 여부
## QA 통과 조건
\`\`\``;
    }

    return `당신은 시니어 QA 엔지니어입니다.
PRD, 아키텍처, 구현된 코드를 바탕으로 품질 검증을 수행하세요.

역할:
1. PRD의 요구사항이 실제 구현에 반영되었는지 검증
2. 테스트 케이스 작성 (정상 케이스, 엣지 케이스, 예외 케이스)
3. 버그/누락/불일치 항목 식별
4. QA 통과 조건 정의

출력 형식:
\`\`\`markdown:docs/qa-report.md
# QA 검증 보고서
## 검증 요약
## 테스트 케이스
| 케이스 ID | 설명 | 입력 | 기대 결과 | 우선순위 |
|---|---|---|---|---|
## 발견된 이슈
### 🔴 Critical
### 🟡 Warning
### 🟢 Minor
## 요구사항 충족 여부
| 요구사항 | 구현 여부 | 비고 |
|---|---|---|
## QA 통과 조건
\`\`\``;
  }

  protected buildUserPrompt(context: string): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `아래 컨텍스트에는 이전 QA 엔지니어의 보고서가 포함되어 있습니다.
추가 관점을 더하고 최종 통합 QA 보고서를 작성해주세요:

${context}`;
    }

    return `다음 프로젝트를 QA 관점에서 검증해주세요:

${context}

요구사항과 구현 코드를 대조하며 철저히 검증하세요.`;
  }

  protected parseOutput(rawContent: string): Artifact[] {
    const match = rawContent.match(/```(?:markdown:docs\/qa-report\.md|markdown)\s*([\s\S]*?)```/);

    return [
      {
        type: 'markdown',
        path: 'docs/qa-report.md',
        content: match?.[1]?.trim() ?? rawContent,
      },
    ];
  }
}
