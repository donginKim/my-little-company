import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';

/**
 * GitAdapter: 변경사항 적용 전 안전 브랜치 생성 및 커밋 관리
 */
export class GitAdapter {
  private git: SimpleGit;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.git = simpleGit(projectPath);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    await this.git.init();
    // 기본 .gitignore 생성
    const { default: fs } = await import('fs/promises');
    await fs.writeFile(
      path.join(this.projectPath, '.gitignore'),
      ['.env', '.env.*', 'node_modules/', 'dist/', '.mlc/cache/'].join('\n'),
      'utf-8'
    );
  }

  async createBranch(branchName: string): Promise<string> {
    const sanitized = branchName.replace(/[^a-zA-Z0-9-_/]/g, '-').toLowerCase();
    const timestamp = Date.now();
    const name = `mlc/${sanitized}-${timestamp}`;

    await this.git.checkoutLocalBranch(name);
    return name;
  }

  async currentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current ?? 'unknown';
  }

  async stageAndCommit(message: string, files?: string[]): Promise<void> {
    if (files && files.length > 0) {
      await this.git.add(files);
    } else {
      await this.git.add('.');
    }
    await this.git.commit(message);
  }

  async getDiff(): Promise<string> {
    return this.git.diff(['HEAD']);
  }
}
