import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextManager } from './ContextManager.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mlc-test-'));
}

describe('ContextManager', () => {
  let tmpDir: string;
  let ctx: ContextManager;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    ctx = new ContextManager(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('초기화 전에는 loadState가 null을 반환한다', async () => {
    const state = await ctx.loadState();
    expect(state).toBeNull();
  });

  it('initState는 state.json을 생성하고 상태를 반환한다', async () => {
    const state = await ctx.initState('my-app', '투두 앱 만들기');

    expect(state.projectName).toBe('my-app');
    expect(state.idea).toBe('투두 앱 만들기');
    expect(state.completedStepIds).toEqual([]);
    expect(state.outputs).toEqual({});
  });

  it('saveState 후 loadState는 동일한 상태를 반환한다', async () => {
    const initial = await ctx.initState('test', 'idea');
    initial.completedStepIds.push('pm-1');
    await ctx.saveState(initial);

    const loaded = await ctx.loadState();
    expect(loaded?.completedStepIds).toContain('pm-1');
    expect(loaded?.projectName).toBe('test');
  });

  it('updateStep은 stepId로 output을 저장하고 completedStepIds에 추가한다', async () => {
    await ctx.initState('test', 'idea');

    const output = {
      role: 'pm' as const,
      artifacts: [{ type: 'markdown' as const, path: 'docs/PRD.md', content: '# PRD' }],
      summary: '요약',
      metadata: { timestamp: new Date().toISOString(), model: 'test', provider: 'test' },
    };

    const updated = await ctx.updateStep('pm-1', output);
    expect(updated.completedStepIds).toContain('pm-1');
    expect(updated.outputs['pm-1']).toBeDefined();
  });

  it('buildContext는 이전 스텝 아티팩트를 포함한 문자열을 반환한다', async () => {
    await ctx.initState('my-app', '투두 앱');
    const output = {
      role: 'pm' as const,
      artifacts: [{ type: 'markdown' as const, path: 'docs/PRD.md', content: '# PRD 내용' }],
      summary: '요약',
      metadata: { timestamp: new Date().toISOString(), model: 'test', provider: 'test' },
    };
    await ctx.updateStep('pm-1', output);

    const context = await ctx.buildContext();
    expect(context).toContain('my-app');
    expect(context).toContain('투두 앱');
    expect(context).toContain('# PRD 내용');
  });

  it('buildContext에 upToStepId를 넘기면 해당 스텝 이전까지만 포함한다', async () => {
    await ctx.initState('my-app', '투두 앱');
    const pmOutput = {
      role: 'pm' as const,
      artifacts: [{ type: 'markdown' as const, path: 'docs/PRD.md', content: '# PRD 내용' }],
      summary: '요약',
      metadata: { timestamp: new Date().toISOString(), model: 'test', provider: 'test' },
    };
    await ctx.updateStep('pm-1', pmOutput);

    // architect-1 이전까지 빌드 → pm-1 포함
    const context = await ctx.buildContext('architect-1');
    expect(context).toContain('# PRD 내용');
  });

  it('CEO 노트가 컨텍스트에 포함된다', async () => {
    await ctx.initState('my-app', '투두 앱');
    const output = {
      role: 'pm' as const,
      artifacts: [],
      summary: '요약',
      metadata: { timestamp: new Date().toISOString(), model: 'test', provider: 'test' },
    };
    await ctx.updateStep('pm-1', output);
    await ctx.addCeoNote('pm-1', 'PM', 'TypeScript strict mode 사용');

    const context = await ctx.buildContext();
    expect(context).toContain('TypeScript strict mode 사용');
  });

  it('초기화되지 않은 프로젝트에서 updateStep은 오류를 던진다', async () => {
    await expect(ctx.updateStep('pm-1')).rejects.toThrow('mlc init');
  });
});
