import type { Artifact } from '../types/index.js';
import { BaseRole } from './RoleEngine.js';

/**
 * PMRole: 아이디어를 PRD.md로 변환
 */
export class PMRole extends BaseRole {
  readonly roleName = 'pm' as const;

  protected buildSystemPrompt(): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `당신은 시니어 제품 관리자(PM)입니다.
이전 PM이 작성한 PRD 초안이 컨텍스트에 포함되어 있습니다. 당신의 역할은 토론 파트너입니다.

진행 방식:
1. 이전 PM의 PRD에서 동의하는 부분과 문제가 있는 부분을 명확히 구분하여 의견을 제시하세요
2. 누락된 요구사항, 과도하게 포함된 항목, 모호한 부분을 구체적으로 지적하세요
3. 토론을 통해 합의된 최종 PRD를 작성하세요

출력 형식:
## 이전 PM 검토
(동의/반대/보완 의견 작성)

## 최종 합의 PRD
(개선된 최종 PRD 전체 내용)`;
    }

    if (this.config.isDocReview) {
      return `당신은 시니어 제품 관리자(PM)입니다.
사전에 작성된 기획서/스펙 문서가 제공되었습니다. 당신의 역할은 검수자입니다.

진행 방식:
1. 제공된 문서를 꼼꼼히 읽고 요구사항의 완성도를 평가하세요
2. 누락된 항목, 모호한 요구사항, 실현 불가능한 항목을 지적하세요
3. 검수 의견을 반영한 최종 PRD를 작성하세요

출력 형식:
## 검수 의견
(누락/모호/개선 필요 항목 목록)

## 최종 PRD
(검수 반영된 완성된 PRD 전체)`;
    }

    return `당신은 시니어 제품 관리자(PM)입니다.
사용자의 아이디어를 분석하여 명확하고 실행 가능한 PRD(Product Requirements Document)를 작성하세요.

출력 형식:
- 반드시 마크다운 형식으로 작성
- 다음 섹션을 포함: 개요, 목표, 사용자 스토리, 기능 요구사항, 비기능 요구사항, MVP 범위, 제외 항목
- 구체적이고 측정 가능한 요구사항 작성
- 기술적인 구현보다 "무엇을 만들어야 하는가"에 집중`;
  }

  protected buildUserPrompt(context: string): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `아래 컨텍스트에는 이전 PM이 작성한 PRD가 포함되어 있습니다.
이전 PM의 분석을 비판적으로 검토하고 토론을 통해 최종 PRD를 완성해주세요.

${context}`;
    }

    if (this.config.isDocReview) {
      return `아래에 기존 기획서가 포함되어 있습니다. 검수 의견을 작성하고 최종 PRD를 완성해주세요:

${context}`;
    }

    return `다음 프로젝트 아이디어를 바탕으로 PRD.md를 작성해주세요:

${context}

PRD는 개발팀이 정확히 무엇을 만들어야 하는지 이해할 수 있도록 상세하게 작성하세요.`;
  }

  protected parseOutput(rawContent: string): Artifact[] {
    // PRD는 전체 응답을 PRD.md로 저장
    return [
      {
        type: 'markdown',
        path: 'docs/PRD.md',
        content: rawContent,
      },
    ];
  }
}
