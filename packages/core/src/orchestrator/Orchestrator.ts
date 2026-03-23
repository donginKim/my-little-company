import type { LLMRouter } from '../llm/LLMRouter.js';
import type { FileChange, ApplyResult, Task, WorkflowState, ResolvedPipelineStep, RoleName } from '../types/index.js';
import type { EventBus } from '../events/EventBus.js';
import { ContextManager } from '../context/ContextManager.js';
import { FileSystemAdapter } from '../fs/FileSystemAdapter.js';
import { GitAdapter } from '../git/GitAdapter.js';
import { ArchitectRole } from '../roles/ArchitectRole.js';
import { DeveloperRole } from '../roles/DeveloperRole.js';
import { PMRole } from '../roles/PMRole.js';
import { ReviewerRole } from '../roles/ReviewerRole.js';
import { QARole } from '../roles/QARole.js';
import type { BaseRole } from '../roles/RoleEngine.js';
import fs from 'fs/promises';
import path from 'path';

export interface OrchestratorConfig {
  projectPath: string;
  readOnly?: boolean;
  stream?: boolean;
  /** 실행할 파이프라인 스텝 목록 (ID·레이블 포함) */
  pipeline?: ResolvedPipelineStep[];
}

/** CLI에서 주입하는 인터럽트 어댑터 인터페이스 (core는 CLI에 의존하지 않는다) */
export interface InterruptAdapter {
  signal: AbortSignal;
  reset(): void;
  checkpoint(
    completedStepId: string,
    completedLabel: string,
    nextStepId: string,
    nextLabel: string
  ): Promise<{ decision: 'continue' | 'note' | 'abort'; note?: string }>;
  startListening(onInterrupt: () => void): void;
  stopListening(): void;
  collectNote(prompt?: string): Promise<string>;
}

export class Orchestrator {
  private router: LLMRouter;
  private context: ContextManager;
  private fsAdapter: FileSystemAdapter;
  private git: GitAdapter;
  private config: OrchestratorConfig;
  private bus?: EventBus;
  private interrupt?: InterruptAdapter;

  constructor(router: LLMRouter, config: OrchestratorConfig, bus?: EventBus, interrupt?: InterruptAdapter) {
    this.router = router;
    this.config = config;
    this.bus = bus;
    this.interrupt = interrupt;
    this.context = new ContextManager(config.projectPath);
    this.fsAdapter = new FileSystemAdapter(config.projectPath, config.readOnly ?? false);
    this.git = new GitAdapter(config.projectPath);
  }

  // ──────────────────────────────────────────────
  // 프로젝트 초기화
  // ──────────────────────────────────────────────

  async initProject(projectName: string, idea: string): Promise<WorkflowState> {
    const isRepo = await this.git.isGitRepo();
    if (!isRepo) await this.git.init();
    return this.context.initState(projectName, idea);
  }

  // ──────────────────────────────────────────────
  // 파이프라인 실행
  // ──────────────────────────────────────────────

  /**
   * 지정된 스텝 하나를 실행하고 FileChange 목록을 반환한다.
   * developer 스텝은 다음 pending 태스크를 자동으로 선택한다.
   */
  async runStep(stepIndex: number, taskId?: string): Promise<FileChange[]> {
    const pipeline = this.config.pipeline ?? [];
    const step = pipeline[stepIndex];
    if (!step) throw new Error(`스텝 ${stepIndex}가 파이프라인에 존재하지 않습니다.`);

    // 이전 스텝과의 체크포인트 (첫 스텝 제외)
    if (stepIndex > 0) {
      const prev = pipeline[stepIndex - 1];
      await this.runCheckpoint(prev.id, prev.label, step.id, step.label);
    }

    const contextStr = await this.context.buildContext();
    this.emitContextTransfer(stepIndex, contextStr);

    let task: Task | undefined;
    if (step.role === 'developer') {
      task = taskId ? (await this.getTask(taskId) ?? undefined) : (await this.getNextPendingTask() ?? undefined);
      if (!task) {
        // Check if architect step exists in pipeline before this step
        const hasArchitectBefore = pipeline
          .slice(0, stepIndex)
          .some((s) => s.role === 'architect');
        if (!hasArchitectBefore) {
          throw new Error(
            `developer 스텝을 실행하려면 파이프라인에 architect 스텝이 먼저 있어야 합니다. ` +
            `설정에서 architect 스텝을 developer 앞에 추가하세요.`
          );
        }
        throw new Error(
          `실행할 태스크가 없습니다. architect 스텝의 결과(tasks.json)가 아직 적용되지 않았거나 ` +
          `모든 태스크가 이미 완료되었습니다.`
        );
      }
    }

    const state = await this.context.loadState();
    const hasPreloadedDocs = (state?.preloadedDocs?.length ?? 0) > 0;
    const isDocReview = hasPreloadedDocs && step.role === 'pm' && step.instanceIndex === 1;
    const role = this.createRole(step, task, isDocReview);

    this.interrupt?.reset();
    this.startStreamInterrupt(step.id, step.label);
    const output = await role.execute(contextStr, this.interrupt?.signal);
    this.interrupt?.stopListening();

    if (step.role === 'developer' && task) {
      await this.updateTaskStatus(task.id, 'done');
    }

    await this.context.updateStep(step.id, output);
    return this.fsAdapter.prepareChanges(output.artifacts);
  }

  /**
   * 다음 pending 스텝 인덱스를 반환한다.
   * 모든 스텝이 완료되었으면 -1을 반환한다.
   */
  async getNextStepIndex(): Promise<number> {
    const state = await this.context.loadState();
    const pipeline = this.config.pipeline ?? [];
    const completedIds = new Set(state?.completedStepIds ?? []);
    return pipeline.findIndex((s) => !completedIds.has(s.id));
  }

  /** 파이프라인 전체 스텝 수 */
  getPipelineLength(): number {
    return (this.config.pipeline ?? []).length;
  }

  /** 스텝 정보 조회 */
  getStep(index: number): ResolvedPipelineStep | undefined {
    return (this.config.pipeline ?? [])[index];
  }

  // ──────────────────────────────────────────────
  // 변경사항 적용
  // ──────────────────────────────────────────────

  /**
   * 외부 문서 파일을 읽어 컨텍스트에 사전 로드한다.
   * mlc plan --file 옵션에서 사용.
   */
  async loadDocuments(filePaths: string[]): Promise<void> {
    const docs: Array<{ name: string; content: string }> = [];
    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const name = path.basename(filePath);
        docs.push({ name, content });
      } catch (err) {
        throw new Error(`문서 파일을 읽을 수 없습니다: ${filePath}`);
      }
    }
    await this.context.setPreloadedDocs(docs);
  }

  async applyChanges(changes: FileChange[]): Promise<ApplyResult> {
    const isRepo = await this.git.isGitRepo();
    if (isRepo) {
      const state = await this.context.loadState();
      const lastId = state?.completedStepIds.at(-1) ?? 'changes';
      await this.git.createBranch(lastId);
    }
    const result = await this.fsAdapter.applyChanges(changes);
    if (isRepo && result.applied.length > 0) {
      const state = await this.context.loadState();
      const lastId = state?.completedStepIds.at(-1) ?? 'changes';
      await this.git.stageAndCommit(
        `feat(mlc): apply ${lastId} [auto]`,
        result.applied
      );
    }
    return result;
  }

  // ──────────────────────────────────────────────
  // 상태 조회
  // ──────────────────────────────────────────────

  async getState(): Promise<WorkflowState | null> {
    return this.context.loadState();
  }

  async getTasks(): Promise<Task[]> {
    try {
      const raw = await this.fsAdapter.readFile('.mlc/tasks.json');
      return (JSON.parse(raw) as any).tasks ?? [];
    } catch {
      return [];
    }
  }

  // ──────────────────────────────────────────────
  // 체크포인트
  // ──────────────────────────────────────────────

  private async runCheckpoint(
    completedId: string,
    completedLabel: string,
    nextId: string,
    nextLabel: string
  ): Promise<void> {
    if (!this.interrupt) return;

    this.bus?.publish({ type: 'ceo:checkpoint', nextStepId: nextId, nextLabel });

    const { decision, note } = await this.interrupt.checkpoint(
      completedId, completedLabel, nextId, nextLabel
    );

    if (decision === 'abort') {
      this.bus?.publish({ type: 'pipeline:abort' });
      throw new Error('사용자가 파이프라인을 중단했습니다.');
    }

    if (decision === 'note' && note) {
      await this.context.addCeoNote(completedId, completedLabel, note);
      this.bus?.publish({ type: 'ceo:interrupt', note, afterStepId: completedId, afterLabel: completedLabel });
    }
  }

  // ──────────────────────────────────────────────
  // 스트리밍 중 개입 감지
  // ──────────────────────────────────────────────

  private startStreamInterrupt(stepId: string, stepLabel: string): void {
    if (!this.interrupt) return;

    this.interrupt.startListening(async () => {
      const note = await this.interrupt!.collectNote('지금까지의 응답에 대한 지시사항');
      if (note) {
        await this.context.addCeoNote(stepId, stepLabel, note);
        this.bus?.publish({ type: 'ceo:interrupt', note, afterStepId: stepId, afterLabel: stepLabel });
      }
    });
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private createRole(step: ResolvedPipelineStep, task?: Task, isDocReview?: boolean): BaseRole {
    const config = {
      llmOptions: {
        provider: step.provider,
        model: step.model,
        temperature: step.temperature,
        maxTokens: step.maxTokens,
      },
      stream: this.config.stream,
      stepId: step.id,
      stepLabel: step.label,
      instanceIndex: step.instanceIndex,
      totalInstances: step.totalInstances,
      isDocReview,
      mode: step.mode,
    };

    switch (step.role) {
      case 'pm':        return new PMRole(this.router, config, this.bus);
      case 'architect': return new ArchitectRole(this.router, config, this.bus);
      case 'developer': {
        const devRole = new DeveloperRole(this.router, config, this.bus);
        if (task) devRole.setTask(task);
        return devRole;
      }
      case 'reviewer':  return new ReviewerRole(this.router, config, this.bus);
      case 'qa':        return new QARole(this.router, config, this.bus);
    }
  }

  private emitContextTransfer(stepIndex: number, context: string): void {
    const pipeline = this.config.pipeline ?? [];
    if (stepIndex === 0) return;
    const prev = pipeline[stepIndex - 1];
    const curr = pipeline[stepIndex];

    this.bus?.publish({
      type: 'context:transfer',
      fromId: prev.id,
      fromLabel: prev.label,
      toId: curr.id,
      toLabel: curr.label,
      length: context.length,
      preview: context.slice(0, 120).replace(/\n/g, ' '),
    });
  }

  private async getTask(taskId: string): Promise<Task | null> {
    return (await this.getTasks()).find((t) => t.id === taskId) ?? null;
  }

  private async getNextPendingTask(): Promise<Task | null> {
    return (await this.getTasks()).find((t) => t.status === 'pending') ?? null;
  }

  private async updateTaskStatus(taskId: string, status: Task['status']): Promise<void> {
    try {
      const raw = await this.fsAdapter.readFile('.mlc/tasks.json');
      const taskList = JSON.parse(raw);
      const task = taskList.tasks?.find((t: Task) => t.id === taskId);
      if (task) {
        task.status = status;
        await fs.writeFile(
          path.join(this.config.projectPath, '.mlc/tasks.json'),
          JSON.stringify(taskList, null, 2),
          'utf-8'
        );
      }
    } catch { /* 무시 */ }
  }
}
