import chalk from 'chalk';
import type { EventBus, MlcEvent, RoleName } from '@mlc/core';

// ──────────────────────────────────────────────
// 역할 프로필
// ──────────────────────────────────────────────

const ROLE_PROFILE: Record<string, {
  name: string;
  color: (s: string) => string;
  bg: (s: string) => string;
}> = {
  pm:        { name: 'PM',          color: chalk.magenta, bg: chalk.bgMagenta },
  architect: { name: 'Architect',   color: chalk.blue,    bg: chalk.bgBlue    },
  developer: { name: 'Developer',   color: chalk.green,   bg: chalk.bgGreen   },
  reviewer:  { name: 'Reviewer',    color: chalk.yellow,  bg: chalk.bgYellow  },
  qa:        { name: 'QA',          color: chalk.cyan,    bg: chalk.bgCyan    },
  unknown:   { name: 'AI',          color: chalk.gray,    bg: chalk.bgGray    },
};

const BUBBLE_WIDTH = 64;

function roleProfile(role: string) {
  return ROLE_PROFILE[role] ?? ROLE_PROFILE['unknown'];
}

function now(): string {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  return `${ampm} ${h % 12 || 12}:${m}`;
}

// ──────────────────────────────────────────────
// LiveDisplay
// ──────────────────────────────────────────────

export class LiveDisplay {
  private bus: EventBus;
  private insideBubble = false;
  private currentLineLen = 0;
  private currentRole: string | null = null;
  private currentStepLabel: string | null = null;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  start(): void {
    this.bus.subscribe((event: MlcEvent) => this.handle(event));
    this.printChatHeader();
  }

  private handle(event: MlcEvent): void {
    switch (event.type) {
      case 'role:start':       this.onRoleStart(event.role, event.stepLabel); break;
      case 'llm:request':      this.onRequest(event.role, event.stepId, event.provider, event.model); break;
      case 'llm:token':        this.onToken(event.token); break;
      case 'llm:response':     this.onResponse(event.usage); break;
      case 'context:transfer': this.onTransfer(event.fromLabel, event.toLabel, event.length); break;
      case 'artifact:save':    this.onArtifact(event.filePath); break;
      case 'role:complete':    this.onComplete(event.role, event.stepLabel); break;
      case 'role:error':       this.onError(event.role, event.stepId, event.error); break;
      case 'ceo:interrupt':    this.onCeoInterrupt(event.note, event.afterLabel); break;
      case 'ceo:checkpoint':   this.onCeoCheckpoint(event.nextLabel); break;
    }
  }

  private printChatHeader(): void {
    console.log('');
    console.log(chalk.bold.bgCyan.black('  My Little Company  '));
    console.log(chalk.dim('─'.repeat(70)));
    console.log('');
  }

  private onRoleStart(role: RoleName, stepLabel: string): void {
    this.currentRole = role;
    this.currentStepLabel = stepLabel;
  }

  private onRequest(role: RoleName, stepId: string, provider: string, model: string): void {
    const p = roleProfile(role);
    // stepLabel이 없으면 stepId를 fallback으로 사용
    const label = this.currentStepLabel ?? stepId;
    console.log('');
    console.log(
      `  ${p.color(chalk.bold(label))}` +
      chalk.dim(`  ·  ${model}  (${provider})`)
    );
    console.log(p.color(' ╭' + '─'.repeat(BUBBLE_WIDTH)));
    process.stdout.write(p.color(' │ '));
    this.currentLineLen = 3;
    this.insideBubble = true;
  }

  private onToken(token: string): void {
    if (!this.insideBubble) return;

    const p = roleProfile(this.currentRole ?? 'unknown');
    const prefix = p.color(' │ ');

    for (let i = 0; i < token.length; i++) {
      const ch = token[i];

      if (ch === '\n') {
        process.stdout.write('\n' + prefix);
        this.currentLineLen = 3;
      } else {
        if (this.currentLineLen >= BUBBLE_WIDTH - 1) {
          process.stdout.write('\n' + prefix);
          this.currentLineLen = 3;
        }
        process.stdout.write(ch);
        this.currentLineLen++;
      }
    }
  }

  private onResponse(usage?: { promptTokens: number; completionTokens: number; totalTokens: number }): void {
    if (!this.insideBubble) return;
    const p = roleProfile(this.currentRole ?? 'unknown');

    process.stdout.write('\n');

    const tokenInfo = usage
      ? chalk.dim(`${usage.completionTokens.toLocaleString()}토큰 출력`)
      : '';
    const time = chalk.dim(now());
    const footer = [tokenInfo, time].filter(Boolean).join('  ·  ');

    console.log(p.color(` ╰─ `) + chalk.dim(footer));
    this.insideBubble = false;
    this.currentLineLen = 0;
  }

  private onArtifact(filePath: string): void {
    const p = roleProfile(this.currentRole ?? 'unknown');
    console.log(
      '  ' + p.color('│') + chalk.dim('  ') +
      p.color(filePath) + chalk.dim(' 저장됨')
    );
  }

  private onComplete(role: RoleName, stepLabel: string): void {
    const p = roleProfile(role);
    console.log('  ' + chalk.dim(`  ✓ ${stepLabel} 완료`));
    this.currentRole = null;
    this.currentStepLabel = null;
  }

  private onError(role: RoleName, stepLabel: string, error: string): void {
    if (this.insideBubble) {
      process.stdout.write('\n');
      this.insideBubble = false;
    }
    const p = roleProfile(role);
    console.log(`  ${p.color(stepLabel)} ${chalk.red('오류:')} ${chalk.red(error)}`);
    this.currentRole = null;
    this.currentStepLabel = null;
  }

  private onTransfer(fromLabel: string, toLabel: string, length: number): void {
    const line = chalk.dim('┄'.repeat(14));
    const label = chalk.dim(fromLabel) + chalk.dim(' → ') + chalk.dim(toLabel);
    const meta = chalk.dim(` (${length.toLocaleString()}자 전달)`);

    console.log('');
    console.log(`  ${line}  ${label}${meta}  ${line}`);
    console.log('');
  }

  onCeoInterrupt(note: string, afterLabel: string): void {
    if (this.insideBubble) {
      process.stdout.write('\n');
      this.insideBubble = false;
    }
    console.log('');
    console.log(chalk.bold.white('  CEO  ') + chalk.dim(`· ${afterLabel} 이후 개입`));
    console.log(chalk.white(' ╭' + '─'.repeat(BUBBLE_WIDTH)));
    const lines = note.split('\n');
    for (const line of lines) {
      console.log(chalk.white(` │ `) + chalk.bold(line));
    }
    console.log(chalk.white(` ╰─ `) + chalk.dim(now()));
    console.log('');
  }

  onCeoCheckpoint(nextLabel: string): void {
    console.log(
      chalk.dim(`  i = 개입   Enter = ${nextLabel} 시작   q = 중단`)
    );
  }
}

export function attachLiveDisplay(bus: EventBus): LiveDisplay {
  const display = new LiveDisplay(bus);
  display.start();
  return display;
}
