import type { Artifact } from '../types/index.js';
import { BaseRole } from './RoleEngine.js';

/**
 * ReviewerRole: 코드베이스를 분석하여 review.md 생성
 */
export class ReviewerRole extends BaseRole {
  readonly roleName = 'reviewer' as const;

  protected buildSystemPrompt(): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `당신은 시니어 코드 리뷰어입니다.
이전 리뷰어의 리뷰 보고서가 컨텍스트에 포함되어 있습니다.

진행 방식:
1. 이전 리뷰어가 놓친 부분이나 추가할 관점을 제시하세요
2. 이전 리뷰와 합쳐진 최종 통합 리뷰 보고서를 작성하세요

출력 형식:
\`\`\`markdown:docs/review.md
# 통합 코드 리뷰 보고서
## 요약
## 심각도별 이슈
### 🔴 Critical
### 🟡 Warning
### 🟢 Suggestion
## 개선 권고사항
## 긍정적인 점
\`\`\``;
    }

    return `당신은 시니어 코드 리뷰어입니다.
제출된 코드를 철저히 검토하고 개선점을 제시하세요.

검토 항목:
1. **버그 및 오류**: 런타임 오류, 로직 버그, 엣지 케이스
2. **코드 품질**: 가독성, 네이밍, 복잡도
3. **보안**: 인젝션, 인증/인가, 민감 데이터 노출
4. **성능**: 비효율적인 알고리즘, 불필요한 연산
5. **아키텍처**: 설계 원칙 위반, 결합도/응집도
6. **테스트 가능성**: 테스트 커버리지, 테스트 용이성

출력 형식:
\`\`\`markdown:docs/review.md
# 코드 리뷰 보고서

## 요약

## 심각도별 이슈
### 🔴 Critical
### 🟡 Warning
### 🟢 Suggestion

## 개선 권고사항

## 긍정적인 점
\`\`\``;
  }

  protected buildUserPrompt(context: string): string {
    return `다음 프로젝트 코드를 리뷰해주세요:

${context}

객관적이고 건설적인 피드백을 제공해주세요.`;
  }

  protected parseOutput(rawContent: string): Artifact[] {
    const match = rawContent.match(/```(?:markdown:docs\/review\.md|markdown)\s*([\s\S]*?)```/);

    return [
      {
        type: 'markdown',
        path: 'docs/review.md',
        content: match?.[1]?.trim() ?? rawContent,
      },
    ];
  }
}
