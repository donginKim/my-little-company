# My Little Company

An AI-powered solo development studio. A single developer operates like a full team by orchestrating multiple AI agents, each assigned a specific role in the software development lifecycle.

English | [한국어](./README.ko.md)

---

## Overview

My Little Company (mlc) accepts a project idea and runs it through a structured role-based pipeline:

```
Idea  ->  PM  ->  Architect  ->  Developer  ->  Reviewer
```

Each role is backed by an LLM and produces structured artifacts that become the input for the next role. The user acts as the decision-maker at every stage, reviewing diffs and approving changes before they are written to disk.

---

## Features

- **Role-based pipeline** - PM, Architect, Developer, and Reviewer each produce structured documents and code
- **Per-role LLM assignment** - assign a different model and provider to each role via YAML config
- **Provider-agnostic LLM routing** - plug in OpenAI, Anthropic, Ollama, or any custom provider
- **Real-time chat view** - watch AI roles communicate in a conversation-style terminal UI with live token streaming
- **CEO interruption** - press `i` at any time to inject instructions mid-stream or between role transitions
- **Safe file operations** - diff preview before every write; sensitive files are never touched
- **Git integration** - automatically creates a branch before applying changes and commits the result
- **Fully local-capable** - works entirely offline with a local Ollama model

---

## Architecture

```
packages/
  core/       Core library: orchestration, roles, LLM routing, file system
  cli/        Command-line interface (mlc)
```

### Core modules

| Module | Responsibility |
|---|---|
| `Orchestrator` | Controls the workflow pipeline and coordinates all modules |
| `LLMRouter` | Routes requests to any registered LLM provider |
| `RoleEngine` | Base class for all AI roles; handles prompt construction and streaming |
| `ContextManager` | Persists workflow state and assembles context for each role |
| `FileSystemAdapter` | Prepares diffs, applies file changes, enforces safety rules |
| `GitAdapter` | Creates branches and commits before applying changes |
| `EventBus` | Typed event system used by all modules to emit observable events |

### LLM Provider model

The `ILLMProvider` interface is the only contract the router depends on:

```typescript
interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  completeStream?(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
```

Built-in providers (`openai`, `anthropic`, `ollama`) are loaded dynamically at runtime so their SDKs are optional peer dependencies. You can register a custom provider at any time:

```typescript
router.register('my-provider', myProvider);
```

---

## Installation

**Prerequisites:** Node.js 18 or later.

```bash
git clone https://github.com/donginKim/my-little-company.git
cd my-little-company
npm install
npm run build
npm link --workspaces
```

The `mlc` command is now available globally.

---

## Configuration

mlc uses a YAML configuration file. On `mlc init`, a ready-to-edit `mlc.config.yaml` is created in the project root. A full annotated template is also available at `mlc.config.example.yaml`.

### Config file search order

mlc looks for configuration in the following order and uses the first file it finds:

1. `<project>/mlc.config.yaml`
2. `<project>/mlc.config.yml`
3. `<project>/mlc.config.json`
4. `~/.mlc/config.yaml`
5. `~/.mlc/config.json`
6. Environment variable auto-detection (fallback)

### Full YAML reference

```yaml
# mlc.config.yaml

llm:
  # Used when a role does not specify its own provider.
  defaultProvider: anthropic

  # Named provider definitions. Keys are referenced in the roles section.
  providers:
    anthropic:
      type: anthropic
      apiKey: ${ANTHROPIC_API_KEY}       # environment variable interpolation
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

# Per-role LLM assignment and generation parameters.
# provider    : key from the providers map above
# model       : overrides the provider's defaultModel
# temperature : 0.0 (precise) to 2.0 (creative)
# maxTokens   : maximum response length
roles:
  pm:
    provider: anthropic
    model: claude-sonnet-4-6
    temperature: 0.8        # creative requirement writing
    maxTokens: 4096

  architect:
    provider: openai
    model: gpt-4o
    temperature: 0.3        # precise system design
    maxTokens: 8192

  developer:
    provider: ollama-code
    model: codellama
    temperature: 0.1        # accurate code generation
    maxTokens: 8192

  reviewer:
    provider: anthropic
    model: claude-sonnet-4-6
    temperature: 0.5
    maxTokens: 4096

# true = never write files, show diffs only
safeMode: false
```

### Provider types

| Type | Description | Required SDK |
|---|---|---|
| `anthropic` | Anthropic Claude models | `npm install @anthropic-ai/sdk` |
| `openai` | OpenAI GPT models | `npm install openai` |
| `ollama` | Local models via Ollama | none (HTTP only) |
| `custom` | Register programmatically via `router.register()` | — |

### Environment variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `MLC_DEFAULT_PROVIDER` | Override the default provider at runtime |

API keys in the YAML file support `${VAR_NAME}` interpolation so secrets stay out of version control.

### Temperature guide

| Range | Recommended for |
|---|---|
| 0.0 – 0.3 | Code generation, architecture design |
| 0.4 – 0.6 | Code review, analysis |
| 0.7 – 1.0 | Requirements writing, creative planning |

---

## Usage

### Initialize a project

```bash
mlc init my-app
cd my-app
```

This creates the project directory, a `mlc.config.yaml` with all providers pre-configured, and a `.mlc/` state directory.

### Set API keys

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
# Ollama requires no key; just have it running locally
```

### Generate a plan

Runs the PM and Architect roles to produce `docs/PRD.md`, `docs/architecture.md`, and `.mlc/tasks.json`.

```bash
mlc plan "A todo app where users can organize tasks by project and deadline"
```

The terminal shows a live conversation view as each AI role produces its output. Review the diffs and confirm before files are written.

### Implement tasks

```bash
# Run the next pending task
mlc run

# Run a specific task by ID
mlc run task-001

# Run all pending tasks in sequence
mlc run --all
```

### Review the code

```bash
mlc review
```

Produces `docs/review.md` with findings categorized by severity.

### Check project status

```bash
mlc status
```

### Verify available LLM providers

```bash
mlc providers
```

---

## Interrupting the pipeline

You can intervene at any point while roles are running.

### Mid-stream interruption

Press `i` while an AI role is streaming its response. The current response stops, and you are prompted to enter instructions:

```
  Developer  claude-sonnet-4-6
 --------------------------------
 | Implementing the TodoList...
        < press i >

  CEO intervention
 --------------------------------
  > Use TypeScript strict mode.
  > Keep all components functional.
  >         < empty line to finish >
```

Your note is saved and injected into the next role's context as a **CEO directive**.

### Checkpoint between roles

Before each role transition, mlc pauses and waits for input:

```
  PM complete  ->  Architect about to start
  Enter = continue   i = add note   q = abort
```

| Key | Action |
|---|---|
| `Enter` | Continue to the next role |
| `i` | Enter a note, then continue |
| `q` | Abort the pipeline |

CEO notes are stored in `.mlc/ceo-notes.json` and automatically included in every subsequent role's context.

### Disable interruption

To run non-interactively (for CI or scripts), use `--no-interactive`:

```bash
mlc plan "idea" --apply --no-interactive
mlc run --all --apply --no-interactive
```

---

## CLI reference

| Command | Description |
|---|---|
| `mlc init <project-name>` | Initialize a new project |
| `mlc plan [idea]` | Run PM and Architect roles |
| `mlc run [task-id]` | Run Developer role for one task |
| `mlc run --all` | Run Developer role for all pending tasks |
| `mlc review` | Run Reviewer role |
| `mlc status` | Show current workflow state and task list |
| `mlc providers` | List registered and available LLM providers |

### Common flags

| Flag | Description |
|---|---|
| `--apply` | Apply file changes without interactive confirmation |
| `--no-interactive` | Disable CEO interruption prompts (for CI) |

---

## Safety

- Files are never overwritten without a diff preview
- The following file patterns are permanently blocked: `.env`, `.env.*`, `*.pem`, `*.key`, `secrets.json`, `credentials.json`
- `safeMode: true` in config enables read-only mode globally
- Every apply operation creates a new Git branch and commits the result

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Tests are colocated with source files (`*.test.ts`) and run with [Vitest](https://vitest.dev).

---

## Extending

### Add a custom LLM provider

```typescript
import { LLMRouter } from '@mlc/core';
import type { ILLMProvider } from '@mlc/core';

class MyProvider implements ILLMProvider {
  readonly name = 'my-provider';
  readonly defaultModel = 'my-model';

  async complete(messages, options) {
    // call your API
  }

  async *completeStream(messages, options) {
    // yield tokens
  }

  async isAvailable() {
    return true;
  }
}

router.register('my-provider', new MyProvider());
```

Then reference it in `mlc.config.yaml`:

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

### Subscribe to the event stream

Every LLM call, token, role transition, CEO note, and file write emits a typed event:

```typescript
import { EventBus } from '@mlc/core';

const bus = new EventBus();

bus.subscribe((event) => {
  switch (event.type) {
    case 'llm:token':      process.stdout.write(event.token); break;
    case 'artifact:save':  console.log('Saved:', event.filePath); break;
    case 'ceo:interrupt':  console.log('CEO note:', event.note); break;
    case 'role:complete':  console.log(event.role, 'done'); break;
  }
});
```

Pass the bus to `createLLMRouterFromConfig` and `Orchestrator` to wire everything together.

---

## Roadmap

- Web dashboard with workflow visualization and diff viewer
- Parallel task execution for independent tasks
- Role prompt customization via config
- Staged changes: accumulate diffs across steps before a single apply
- Plugin system for custom roles

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes with tests
4. Run `npm test` and `npm run build` to verify
5. Open a pull request

---

## License

MIT

---

## Contact

Dongin Kim (amiroKim) — steve99890@gmail.com
