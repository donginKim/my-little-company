import chalk from 'chalk';
import type { FileChange } from '@mlc/core';

export function printBanner(): void {
  console.log(
    chalk.cyan(`
╔════════════════════════════════════╗
║       My Little Company  v0.1      ║
║   AI-powered solo dev studio       ║
╚════════════════════════════════════╝
`)
  );
}

export function printStep(step: string, message: string): void {
  console.log(`\n${chalk.bold.blue(`[${step.toUpperCase()}]`)} ${message}`);
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function printError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

export function printWarning(message: string): void {
  console.warn(chalk.yellow(`⚠ ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.gray(`  ${message}`));
}

export function printDiffs(changes: FileChange[]): void {
  if (changes.length === 0) {
    printInfo('변경 사항 없음');
    return;
  }

  console.log(`\n${chalk.bold('변경 예정 파일:')}`);
  for (const change of changes) {
    const icon = change.type === 'create' ? chalk.green('+') : chalk.yellow('~');
    const label =
      change.type === 'create'
        ? chalk.green('신규')
        : change.type === 'delete'
          ? chalk.red('삭제')
          : chalk.yellow('수정');

    console.log(`  ${icon} ${chalk.bold(change.path)} ${chalk.dim(`[${label}]`)}`);

    if (change.diff) {
      // diff 출력 (색상 적용)
      const lines = change.diff.split('\n');
      for (const line of lines.slice(0, 30)) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          process.stdout.write(chalk.green(line) + '\n');
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          process.stdout.write(chalk.red(line) + '\n');
        } else if (line.startsWith('@@')) {
          process.stdout.write(chalk.cyan(line) + '\n');
        } else {
          process.stdout.write(chalk.dim(line) + '\n');
        }
      }
      if (lines.length > 30) {
        printInfo(`... 외 ${lines.length - 30}줄`);
      }
    }
  }
}

export function printTaskList(tasks: Array<{ id: string; title: string; status: string }>): void {
  const statusIcon: Record<string, string> = {
    pending: chalk.gray('○'),
    in_progress: chalk.yellow('◐'),
    done: chalk.green('●'),
    skipped: chalk.dim('–'),
  };

  console.log(`\n${chalk.bold('태스크 목록:')}`);
  for (const task of tasks) {
    const icon = statusIcon[task.status] ?? '?';
    console.log(`  ${icon} ${chalk.bold(task.id)} - ${task.title} ${chalk.dim(`[${task.status}]`)}`);
  }
}
