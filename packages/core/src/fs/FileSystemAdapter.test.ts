import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemAdapter } from './FileSystemAdapter.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mlc-fs-test-'));
}

describe('FileSystemAdapter', () => {
  let tmpDir: string;
  let adapter: FileSystemAdapter;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    adapter = new FileSystemAdapter(tmpDir, false);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('prepareChanges', () => {
    it('신규 파일은 type=create로 반환한다', async () => {
      const changes = await adapter.prepareChanges([
        { type: 'markdown', path: 'docs/PRD.md', content: '# PRD' },
      ]);

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('create');
      expect(changes[0].path).toBe('docs/PRD.md');
      expect(changes[0].content).toBe('# PRD');
    });

    it('기존 파일은 type=modify로 반환하고 diff를 포함한다', async () => {
      const filePath = path.join(tmpDir, 'src', 'index.ts');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, 'const a = 1;', 'utf-8');

      const changes = await adapter.prepareChanges([
        { type: 'code', path: 'src/index.ts', content: 'const a = 2;' },
      ]);

      expect(changes[0].type).toBe('modify');
      expect(changes[0].diff).toBeDefined();
      expect(changes[0].diff).toContain('-const a = 1;');
      expect(changes[0].diff).toContain('+const a = 2;');
    });

    it('민감 파일(.env)은 변경 목록에 포함되지 않는다', async () => {
      const changes = await adapter.prepareChanges([
        { type: 'code', path: '.env', content: 'SECRET=abc' },
        { type: 'markdown', path: 'README.md', content: '# Hello' },
      ]);

      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('README.md');
    });

    it('.pem, .key, secrets.json 파일도 필터링한다', async () => {
      const changes = await adapter.prepareChanges([
        { type: 'code', path: 'server.pem', content: 'cert' },
        { type: 'code', path: 'private.key', content: 'key' },
        { type: 'json', path: 'secrets.json', content: '{}' },
        { type: 'markdown', path: 'docs/README.md', content: 'ok' },
      ]);

      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('docs/README.md');
    });
  });

  describe('applyChanges', () => {
    it('신규 파일을 생성한다', async () => {
      const changes = await adapter.prepareChanges([
        { type: 'markdown', path: 'docs/PRD.md', content: '# PRD' },
      ]);
      const result = await adapter.applyChanges(changes);

      expect(result.applied).toContain('docs/PRD.md');
      expect(result.errors).toHaveLength(0);

      const content = await fs.readFile(path.join(tmpDir, 'docs/PRD.md'), 'utf-8');
      expect(content).toBe('# PRD');
    });

    it('중첩 디렉터리도 자동으로 생성한다', async () => {
      const changes = await adapter.prepareChanges([
        { type: 'code', path: 'src/deep/nested/file.ts', content: 'export {}' },
      ]);
      const result = await adapter.applyChanges(changes);

      expect(result.applied).toContain('src/deep/nested/file.ts');
    });

    it('readOnly 모드에서는 파일을 실제로 쓰지 않는다', async () => {
      const readOnlyAdapter = new FileSystemAdapter(tmpDir, true);
      const changes = await readOnlyAdapter.prepareChanges([
        { type: 'markdown', path: 'test.md', content: 'content' },
      ]);
      const result = await readOnlyAdapter.applyChanges(changes);

      expect(result.applied).toHaveLength(0);
      expect(result.skipped).toContain('test.md');

      await expect(
        fs.access(path.join(tmpDir, 'test.md'))
      ).rejects.toThrow();
    });
  });

  describe('readFile', () => {
    it('파일 내용을 반환한다', async () => {
      await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'world', 'utf-8');
      const content = await adapter.readFile('hello.txt');
      expect(content).toBe('world');
    });

    it('존재하지 않는 파일은 오류를 던진다', async () => {
      await expect(adapter.readFile('no-such-file.txt')).rejects.toThrow();
    });
  });

  describe('getFileTree', () => {
    it('파일 트리 문자열을 반환한다', async () => {
      await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'src', 'index.ts'), '', 'utf-8');
      await fs.writeFile(path.join(tmpDir, 'README.md'), '', 'utf-8');

      const tree = await adapter.getFileTree();
      expect(tree).toContain('src');
      expect(tree).toContain('index.ts');
      expect(tree).toContain('README.md');
    });
  });
});
