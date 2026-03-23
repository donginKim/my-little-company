import type { Artifact, Task } from '../types/index.js';
import { BaseRole } from './RoleEngine.js';

/**
 * DeveloperRole: 특정 Task를 받아 코드 파일 생성
 */
export class DeveloperRole extends BaseRole {
  readonly roleName = 'developer' as const;
  private task: Task | null = null;

  setTask(task: Task): void {
    this.task = task;
  }

  protected buildSystemPrompt(): string {
    const isFollowUp = (this.config.instanceIndex ?? 1) > 1;

    if (isFollowUp) {
      return `당신은 시니어 소프트웨어 개발자입니다.
이전 개발자가 작성한 코드가 컨텍스트에 포함되어 있습니다. 당신의 역할은 코드 리뷰어 겸 개선자입니다.

진행 방식:
1. 이전 개발자의 코드에서 개선할 부분(버그, 성능, 가독성)을 지적하세요
2. 더 나은 구현 방식을 제안하세요
3. 최종 개선된 코드를 작성하세요

출력 형식:
## 코드 검토
(개선 의견)

\`\`\`<language>:<file-path>
// 개선된 코드
\`\`\``;
    }

    const isFull = this.config.mode === 'full';

    const baseFormat = `출력 형식:
- 각 파일을 다음 형식으로 작성:
  \`\`\`<language>:<file-path>
  // 코드 내용
  \`\`\`
- 예시: \`\`\`typescript:src/index.ts
- 완전하고 동작하는 코드를 작성하세요 (TODO 없이)
- 주석은 핵심 로직에만 간단히 작성
- 에러 처리 포함
- 기존 코드와 일관된 스타일 유지`;

    if (isFull) {
      return `당신은 시니어 소프트웨어 개발자입니다.
아키텍처 설계와 태스크 명세를 바탕으로 실제 코드와 프로젝트 설정 파일 전체를 작성하세요.

반드시 다음 파일들을 포함하세요 (해당하는 경우):
- 의존성 파일: package.json / requirements.txt / go.mod / Cargo.toml / pom.xml 등
- 실행 스크립트: Makefile / scripts/start.sh / scripts/setup.sh 등
- 컨테이너: Dockerfile / docker-compose.yml (서버 프로젝트의 경우)
- 환경 설정: .env.example
- README.md 의 ## 설치 및 실행 섹션 (설치 명령어, 실행 방법, 환경 변수 설명)

${baseFormat}`;
    }

    return `당신은 시니어 소프트웨어 개발자입니다.
아키텍처 설계와 태스크 명세를 바탕으로 실제 코드를 작성하세요.

${baseFormat}`;
  }

  protected buildUserPrompt(context: string): string {
    const taskInfo = this.task
      ? `\n## 현재 태스크\n**ID**: ${this.task.id}\n**제목**: ${this.task.title}\n**설명**: ${this.task.description}\n**대상 파일**: ${this.task.artifacts?.join(', ') ?? '미지정'}\n`
      : '';

    return `다음 컨텍스트를 바탕으로 코드를 작성해주세요:

${context}
${taskInfo}
완성된 코드를 작성하세요.`;
  }

  protected parseOutput(rawContent: string): Artifact[] {
    const artifacts: Artifact[] = [];

    // ```<lang>:<path> 형식 파싱
    const fileBlockRegex = /```(\w+):([^\n`]+)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = fileBlockRegex.exec(rawContent)) !== null) {
      const [, lang, filePath, code] = match;
      artifacts.push({
        type: 'code',
        path: filePath.trim(),
        content: code.trim(),
      });
    }

    // 매칭 없으면 전체를 하나의 파일로
    if (artifacts.length === 0 && this.task?.artifacts?.[0]) {
      artifacts.push({
        type: 'code',
        path: this.task.artifacts[0],
        content: rawContent,
      });
    }

    return artifacts;
  }
}
