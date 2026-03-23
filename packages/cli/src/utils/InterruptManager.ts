import readline from 'readline';
import chalk from 'chalk';

export type CheckpointDecision = 'continue' | 'note' | 'abort';

export class InterruptManager {
  private abortController = new AbortController();
  private rawModeActive = false;
  private keypressHandler: ((ch: string, key: any) => void) | null = null;

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  reset(): void {
    this.abortController = new AbortController();
  }

  startListening(onInterrupt: () => void): void {
    if (this.rawModeActive || !process.stdin.isTTY) return;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    this.rawModeActive = true;

    this.keypressHandler = (_ch: string, key: any) => {
      if (key?.ctrl && key?.name === 'c') {
        this.stopListening();
        process.exit(0);
      }
      if (key?.name === 'i') {
        this.stopListening();
        onInterrupt();
      }
    };

    process.stdin.on('keypress', this.keypressHandler);
  }

  stopListening(): void {
    if (!this.rawModeActive) return;
    if (this.keypressHandler) {
      process.stdin.off('keypress', this.keypressHandler);
      this.keypressHandler = null;
    }
    try {
      process.stdin.setRawMode(false);
    } catch { /* TTY 이미 해제된 경우 무시 */ }
    this.rawModeActive = false;
  }

  async collectNote(prompt = '지시사항'): Promise<string> {
    this.stopListening();

    process.stdout.write('\n');
    console.log(chalk.bold.cyan('┌─ CEO 개입 ') + chalk.dim('─'.repeat(50)));
    console.log(chalk.dim('│ 빈 줄로 입력을 마칩니다'));
    console.log(chalk.bold.cyan('└' + '─'.repeat(59)));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const lines: string[] = [];

    return new Promise((resolve) => {
      const askLine = () => {
        rl.question(chalk.cyan('  > '), (line) => {
          if (line.trim() === '') {
            rl.close();
            resolve(lines.join('\n').trim());
          } else {
            lines.push(line);
            askLine();
          }
        });
      };

      rl.on('close', () => {
        resolve(lines.join('\n').trim());
      });

      askLine();
    });
  }

  /**
   * 스텝 전환 체크포인트.
   * completedLabel, nextLabel은 화면 표시용 문자열이다.
   */
  async checkpoint(
    _completedStepId: string,
    completedLabel: string,
    _nextStepId: string,
    nextLabel: string
  ): Promise<{ decision: CheckpointDecision; note?: string }> {
    this.stopListening();

    process.stdout.write('\n');
    console.log(
      chalk.dim('  ─'.repeat(35)) + '\n' +
      `  ${chalk.bold(completedLabel)} 완료  →  ${chalk.bold(nextLabel)} 시작 전\n` +
      chalk.dim(`  Enter = 계속   i = 메모 추가   q = 중단`) + '\n' +
      chalk.dim('  ─'.repeat(35))
    );
    process.stdout.write('  > ');

    return new Promise((resolve) => {
      if (!process.stdin.isTTY) {
        resolve({ decision: 'continue' });
        return;
      }

      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);

      const handler = (_ch: string, key: any) => {
        if (!key) return;

        if (key.ctrl && key.name === 'c') {
          process.stdin.setRawMode(false);
          process.stdin.off('keypress', handler);
          process.stdout.write('\n');
          process.exit(0);
        }

        if (key.name === 'return' || key.name === 'space') {
          process.stdin.setRawMode(false);
          process.stdin.off('keypress', handler);
          process.stdout.write('\n');
          resolve({ decision: 'continue' });
          return;
        }

        if (key.name === 'i') {
          process.stdin.setRawMode(false);
          process.stdin.off('keypress', handler);
          process.stdout.write('\n');

          this.collectNote().then((note) => {
            if (!note) {
              resolve({ decision: 'continue' });
            } else {
              resolve({ decision: 'note', note });
            }
          });
          return;
        }

        if (key.name === 'q') {
          process.stdin.setRawMode(false);
          process.stdin.off('keypress', handler);
          process.stdout.write('\n');
          resolve({ decision: 'abort' });
          return;
        }
      };

      process.stdin.on('keypress', handler);
    });
  }
}
