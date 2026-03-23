    # My Little Company

AI 기반 1인 개발 스튜디오. 혼자 일하는 개발자가 여러 AI 에이전트에게 역할을 맡겨 실제 팀처럼 소프트웨어를 만들 수 있는 시스템입니다.

[English](./README.md) | 한국어

---

## 개요

My Little Company(mlc)는 프로젝트 아이디어를 입력받아 역할 기반 파이프라인으로 처리합니다.

```
아이디어  ->  기획자(PM)  ->  아키텍트  ->  개발자  ->  리뷰어
```

각 역할은 LLM이 수행하며, 이전 역할의 결과물을 입력으로 받아 다음 역할에 넘길 구조화된 산출물을 만듭니다. 사용자는 매 단계마다 diff를 검토하고 파일 적용 여부를 직접 결정합니다.

---

## 주요 기능

- **역할 기반 파이프라인** - 기획자, 아키텍트, 개발자, 리뷰어 각각이 구조화된 문서와 코드를 생성
- **역할별 LLM 지정** - YAML 설정으로 각 역할에 다른 모델과 프로바이더를 할당
- **프로바이더 독립적 LLM 라우팅** - OpenAI, Anthropic, Ollama, 직접 구현한 프로바이더 모두 지원
- **실시간 채팅 뷰** - 각 AI 역할이 대화하는 모습을 카카오톡 스타일 버블로 터미널에서 확인
- **CEO 개입** - 스트리밍 중 또는 역할 전환 시 `i` 키로 언제든지 지시사항 주입
- **안전한 파일 처리** - 모든 쓰기 전에 diff 미리보기, 민감 파일은 절대 수정하지 않음
- **Git 연동** - 변경사항 적용 전 자동으로 새 브랜치를 만들고 커밋
- **완전 로컬 지원** - Ollama 로컬 모델만으로 인터넷 없이 동작

---

## 아키텍처

```
packages/
  core/       핵심 라이브러리: 오케스트레이션, 역할, LLM 라우팅, 파일 시스템
  cli/        커맨드라인 인터페이스 (mlc)
```

### 핵심 모듈

| 모듈 | 역할 |
|---|---|
| `Orchestrator` | 전체 워크플로우 파이프라인 조율 |
| `LLMRouter` | 등록된 LLM 프로바이더로 요청 라우팅 |
| `RoleEngine` | 모든 AI 역할의 기반 클래스. 프롬프트 구성과 스트리밍 처리 |
| `ContextManager` | 워크플로우 상태를 영속화하고 각 역할에 필요한 컨텍스트 조합 |
| `FileSystemAdapter` | diff 생성, 파일 변경 적용, 민감 파일 차단 |
| `GitAdapter` | 변경 적용 전 브랜치 생성 및 커밋 |
| `EventBus` | 타입 안전 이벤트 시스템. 모든 LLM 호출과 파일 작업을 관찰 가능하게 만듦 |

### LLM 프로바이더 모델

라우터가 의존하는 계약은 `ILLMProvider` 인터페이스 하나뿐입니다.

```typescript
interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  completeStream?(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
```

내장 프로바이더(`openai`, `anthropic`, `ollama`)의 SDK는 런타임에 동적으로 로드되므로 선택적 peer dependency입니다. 커스텀 프로바이더는 언제든 등록할 수 있습니다.

```typescript
router.register('my-provider', myProvider);
```

---

## 설치

**요구사항:** Node.js 18 이상

```bash
git clone https://github.com/donginKim/my-little-company.git
cd my-little-company
npm install
npm run build
npm link --workspaces
```

설치 후 `mlc` 명령어를 전역에서 사용할 수 있습니다.

---

## 설정

mlc는 YAML 설정 파일을 사용합니다. `mlc init` 실행 시 프로젝트 루트에 편집 가능한 `mlc.config.yaml`이 자동 생성됩니다. 전체 주석이 달린 템플릿은 `mlc.config.example.yaml`을 참고하세요.

### 설정 파일 탐색 순서

아래 순서로 파일을 찾아 처음 발견된 것을 사용합니다.

1. `<프로젝트>/mlc.config.yaml`
2. `<프로젝트>/mlc.config.yml`
3. `<프로젝트>/mlc.config.json`
4. `~/.mlc/config.yaml`
5. `~/.mlc/config.json`
6. 환경변수 자동 감지 (최종 폴백)

### YAML 전체 레퍼런스

```yaml
# mlc.config.yaml

llm:
  # 역할에서 provider를 지정하지 않으면 이 프로바이더를 사용합니다.
  defaultProvider: anthropic

  # 이름을 붙인 프로바이더 정의. 키는 roles 섹션에서 참조합니다.
  providers:
    anthropic:
      type: anthropic
      apiKey: ${ANTHROPIC_API_KEY}       # 환경변수 자동 보간
      defaultModel: claude-sonnet-4-6

    claude-haiku:
      type: anthropic
      apiKey: ${ANTHROPIC_API_KEY}
      defaultModel: claude-haiku-4-5-20251001

    openai:
      type: openai
      apiKey: ${OPENAI_API_KEY}
      defaultModel: gpt-4o

    openai-mini:
      type: openai
      apiKey: ${OPENAI_API_KEY}
      defaultModel: gpt-4o-mini

    ollama:
      type: ollama
      baseUrl: http://localhost:11434
      defaultModel: llama3

    ollama-code:
      type: ollama
      baseUrl: http://localhost:11434
      defaultModel: codellama

# 역할별 LLM 할당 및 생성 파라미터
# provider    : 위 providers 맵의 키
# model       : 프로바이더 기본 모델 오버라이드
# temperature : 0.0(정확) ~ 2.0(창의적)
# maxTokens   : 최대 응답 길이
roles:
  pm:
    provider: anthropic
    model: claude-sonnet-4-6
    temperature: 0.8        # 창의적인 요구사항 작성
    maxTokens: 4096

  architect:
    provider: openai
    model: gpt-4o
    temperature: 0.3        # 정밀한 시스템 설계
    maxTokens: 8192

  developer:
    provider: ollama-code
    model: codellama
    temperature: 0.1        # 코드는 정확성 최우선
    maxTokens: 8192

  reviewer:
    provider: anthropic
    model: claude-sonnet-4-6
    temperature: 0.5
    maxTokens: 4096

# true로 설정하면 파일을 실제로 쓰지 않습니다 (diff 미리보기만)
safeMode: false
```

### 프로바이더 타입

| 타입 | 설명 | 필요 SDK |
|---|---|---|
| `anthropic` | Anthropic Claude 모델 | `npm install @anthropic-ai/sdk` |
| `openai` | OpenAI GPT 모델 | `npm install openai` |
| `ollama` | Ollama 로컬 모델 | 없음 (HTTP only) |
| `custom` | `router.register()`로 직접 등록 | — |

### 환경변수

| 변수 | 설명 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API 키 |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `MLC_DEFAULT_PROVIDER` | 런타임 기본 프로바이더 재정의 |

YAML 파일 내 API 키는 `${VAR_NAME}` 형식으로 환경변수를 참조하므로 시크릿을 버전 관리에 포함시키지 않아도 됩니다.

### temperature 가이드

| 범위 | 권장 용도 |
|---|---|
| 0.0 – 0.3 | 코드 생성, 아키텍처 설계 |
| 0.4 – 0.6 | 코드 리뷰, 분석 |
| 0.7 – 1.0 | 요구사항 작성, 창의적 기획 |

---

## 사용법

### 프로젝트 초기화

```bash
mlc init my-app
cd my-app
```

프로젝트 디렉터리, 모든 프로바이더가 미리 설정된 `mlc.config.yaml`, `.mlc/` 상태 디렉터리가 생성됩니다.

### API 키 설정

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
# Ollama는 키 불필요, 로컬에서 실행 중이면 됩니다
```

### 플랜 생성

기획자(PM)와 아키텍트 역할을 순서대로 실행해 `docs/PRD.md`, `docs/architecture.md`, `.mlc/tasks.json`을 생성합니다.

```bash
mlc plan "프로젝트와 마감일별로 할 일을 관리할 수 있는 투두 앱"
```

각 AI 역할이 응답을 생성하는 동안 터미널에 실시간 채팅 뷰가 표시됩니다. diff를 검토한 뒤 파일 적용 여부를 확인합니다.

### 태스크 구현

```bash
# 다음 pending 태스크 실행
mlc run

# 특정 태스크 ID 지정
mlc run task-001

# 모든 pending 태스크 순서대로 실행
mlc run --all
```

### 코드 리뷰

```bash
mlc review
```

심각도별로 분류된 리뷰 보고서를 `docs/review.md`에 생성합니다.

### 프로젝트 상태 확인

```bash
mlc status
```

### 사용 가능한 LLM 프로바이더 확인

```bash
mlc providers
```

---

## 파이프라인 개입 (CEO 모드)

AI 역할이 실행되는 중에 언제든지 끼어들어 지시사항을 줄 수 있습니다.

### 스트리밍 중 개입

AI 역할이 응답을 스트리밍하는 도중 `i` 키를 누르면 현재 응답이 중단되고 입력 프롬프트가 나타납니다.

```
  개발자  claude-sonnet-4-6
 --------------------------------
 | TodoList 컴포넌트를 구현하겠습니다...
        < i 키 입력 >

  CEO 개입
 --------------------------------
  > TypeScript strict mode를 사용해 주세요.
  > 모든 컴포넌트는 함수형으로 작성해 주세요.
  >         < 빈 줄로 입력 완료 >
```

입력한 내용은 다음 역할의 컨텍스트에 **CEO 지시사항** 섹션으로 자동 포함됩니다.

### 역할 전환 체크포인트

각 역할이 완료되고 다음 역할이 시작되기 전에 mlc가 일시 정지하고 입력을 기다립니다.

```
  기획자 PM 완료  ->  아키텍트 시작 전
  Enter = 계속   i = 메모 추가   q = 중단
```

| 키 | 동작 |
|---|---|
| `Enter` | 다음 역할로 그냥 진행 |
| `i` | 메모를 입력한 뒤 진행 |
| `q` | 파이프라인 전체 중단 |

CEO 메모는 `.mlc/ceo-notes.json`에 저장되고, 이후 모든 역할의 컨텍스트에 자동으로 포함됩니다.

### 개입 비활성화

CI 환경 또는 스크립트에서 비대화형으로 실행하려면 `--no-interactive`를 사용합니다.

```bash
mlc plan "아이디어" --apply --no-interactive
mlc run --all --apply --no-interactive
```

---

## CLI 명령어 참조

| 명령어 | 설명 |
|---|---|
| `mlc init <project-name>` | 새 프로젝트 초기화 |
| `mlc plan [idea]` | 기획자, 아키텍트 역할 실행 |
| `mlc run [task-id]` | 개발자 역할로 태스크 하나 실행 |
| `mlc run --all` | 모든 pending 태스크 순서대로 실행 |
| `mlc review` | 리뷰어 역할 실행 |
| `mlc status` | 현재 워크플로우 상태와 태스크 목록 표시 |
| `mlc providers` | 등록된 LLM 프로바이더 상태 확인 |

### 주요 플래그

| 플래그 | 설명 |
|---|---|
| `--apply` | 인터랙티브 확인 없이 파일 변경사항 즉시 적용 |
| `--no-interactive` | CEO 개입 프롬프트 비활성화 (CI용) |

---

## 안전 규칙

- 파일은 diff 미리보기 없이 절대 덮어쓰지 않습니다
- 다음 패턴의 파일은 수정이 영구 차단됩니다: `.env`, `.env.*`, `*.pem`, `*.key`, `secrets.json`, `credentials.json`
- 설정에서 `safeMode: true`로 전역 읽기 전용 모드를 활성화할 수 있습니다
- 모든 적용 작업은 새 Git 브랜치를 만들고 결과를 커밋합니다

---

## 테스트

```bash
# 전체 테스트 실행
npm test

# 감시 모드
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

테스트 파일(`*.test.ts`)은 소스 파일과 같은 위치에 있으며 [Vitest](https://vitest.dev)로 실행합니다.

---

## 확장하기

### 커스텀 LLM 프로바이더 추가

```typescript
import { LLMRouter } from '@mlc/core';
import type { ILLMProvider } from '@mlc/core';

class MyProvider implements ILLMProvider {
  readonly name = 'my-provider';
  readonly defaultModel = 'my-model';

  async complete(messages, options) {
    // 직접 구현한 API 호출
  }

  async *completeStream(messages, options) {
    // 토큰 단위로 yield
  }

  async isAvailable() {
    return true;
  }
}

router.register('my-provider', new MyProvider());
```

`mlc.config.yaml`에서 참조합니다.

```yaml
llm:
  providers:
    my-provider:
      type: custom

roles:
  developer:
    provider: my-provider
    temperature: 0.2
```

### 이벤트 스트림 구독

LLM 호출, 토큰, 역할 전환, CEO 개입, 파일 저장 등 모든 동작이 타입 안전 이벤트로 발행됩니다.

```typescript
import { EventBus } from '@mlc/core';

const bus = new EventBus();

bus.subscribe((event) => {
  switch (event.type) {
    case 'llm:token':     process.stdout.write(event.token); break;
    case 'artifact:save': console.log('저장됨:', event.filePath); break;
    case 'ceo:interrupt': console.log('CEO 지시사항:', event.note); break;
    case 'role:complete': console.log(event.role, '완료'); break;
  }
});
```

`createLLMRouterFromConfig`와 `Orchestrator` 생성 시 버스를 전달해 연결합니다.

---

## 로드맵

- 워크플로우 시각화와 diff 뷰어를 포함한 웹 대시보드
- 의존성 없는 태스크의 병렬 실행
- 역할별 프롬프트 커스터마이징
- 여러 단계의 diff를 모아 한 번에 적용하는 staged changes
- 커스텀 역할 플러그인 시스템

---

## 기여하기

1. 저장소를 포크합니다
2. 피처 브랜치를 만듭니다: `git checkout -b feat/your-feature`
3. 테스트와 함께 변경사항을 작성합니다
4. `npm test`와 `npm run build`로 검증합니다
5. Pull Request를 열어주세요

---

## 라이선스

MIT

---

## 연락처

김동인 (amiroKim) — steve99890@gmail.com
