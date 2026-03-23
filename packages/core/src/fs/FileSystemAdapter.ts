import fs from 'fs/promises';
import path from 'path';
import * as diffLib from 'diff';
import type { Artifact, FileChange, ApplyResult } from '../types/index.js';

/** 절대로 건드리면 안 되는 파일 패턴 */
const SENSITIVE_PATTERNS = [
  /\.env(\..+)?$/,
  /secrets?\.(json|yaml|yml)$/,
  /credentials?\.(json|yaml|yml)$/,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
];

/**
 * FileSystemAdapter: 파일 읽기/쓰기 + diff 생성 + 안전 모드
 */
export class FileSystemAdapter {
  private projectPath: string;
  private readOnly: boolean;

  constructor(projectPath: string, readOnly = false) {
    this.projectPath = projectPath;
    this.readOnly = readOnly;
  }

  /** artifacts를 FileChange 목록으로 변환 (diff 포함) */
  async prepareChanges(artifacts: Artifact[]): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    for (const artifact of artifacts) {
      const absolutePath = path.join(this.projectPath, artifact.path);

      if (this.isSensitive(artifact.path)) {
        console.warn(`[보안] 민감 파일 건너뜀: ${artifact.path}`);
        continue;
      }

      let existing: string | null = null;
      try {
        existing = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        // 새 파일
      }

      const type = existing === null ? 'create' : 'modify';
      const diff =
        type === 'modify'
          ? diffLib.createTwoFilesPatch(
              artifact.path,
              artifact.path,
              existing!,
              artifact.content,
              'before',
              'after'
            )
          : null;

      changes.push({
        path: artifact.path,
        type,
        content: artifact.content,
        diff: diff ?? undefined,
      });
    }

    return changes;
  }

  /** FileChange 목록을 실제 파일에 적용 */
  async applyChanges(changes: FileChange[]): Promise<ApplyResult> {
    if (this.readOnly) {
      return {
        applied: [],
        skipped: changes.map((c) => c.path),
        errors: [],
      };
    }

    const result: ApplyResult = { applied: [], skipped: [], errors: [] };

    for (const change of changes) {
      const absolutePath = path.join(this.projectPath, change.path);

      try {
        if (change.type === 'delete') {
          await fs.unlink(absolutePath);
        } else {
          await fs.mkdir(path.dirname(absolutePath), { recursive: true });
          await fs.writeFile(absolutePath, change.content ?? '', 'utf-8');
        }
        result.applied.push(change.path);
      } catch (err) {
        result.errors.push({ path: change.path, error: String(err) });
      }
    }

    return result;
  }

  /** 파일 읽기 */
  async readFile(relativePath: string): Promise<string> {
    return fs.readFile(path.join(this.projectPath, relativePath), 'utf-8');
  }

  /** 디렉터리 트리 구조를 문자열로 반환 (컨텍스트 주입용) */
  async getFileTree(maxDepth = 4): Promise<string> {
    const lines: string[] = [];
    await this.walk(this.projectPath, '', 0, maxDepth, lines);
    return lines.join('\n');
  }

  private async walk(
    dir: string,
    prefix: string,
    depth: number,
    maxDepth: number,
    lines: string[]
  ): Promise<void> {
    if (depth > maxDepth) return;

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const filtered = entries.filter(
      (e) => !['node_modules', '.git', '.mlc', 'dist'].includes(e.name)
    );

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const isLast = i === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      lines.push(`${prefix}${connector}${entry.name}`);

      if (entry.isDirectory()) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        await this.walk(path.join(dir, entry.name), newPrefix, depth + 1, maxDepth, lines);
      }
    }
  }

  private isSensitive(filePath: string): boolean {
    return SENSITIVE_PATTERNS.some((p) => p.test(path.basename(filePath)));
  }
}
