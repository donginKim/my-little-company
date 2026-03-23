import fs from 'fs/promises';
import path from 'path';
import type { WorkflowState, RoleOutput } from '../types/index.js';

const STATE_FILE = '.mlc/state.json';
const CEO_NOTES_FILE = '.mlc/ceo-notes.json';

export interface CeoNote {
  afterStepId: string;
  afterLabel: string;
  note: string;
  timestamp: string;
}

export class ContextManager {
  private projectPath: string;
  private statePath: string;
  private notesPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.statePath = path.join(projectPath, STATE_FILE);
    this.notesPath = path.join(projectPath, CEO_NOTES_FILE);
  }

  async loadState(): Promise<WorkflowState | null> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      return JSON.parse(raw) as WorkflowState;
    } catch {
      return null;
    }
  }

  async saveState(state: WorkflowState): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    state.updatedAt = new Date().toISOString();
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  async initState(projectName: string, idea: string): Promise<WorkflowState> {
    const state: WorkflowState = {
      projectName,
      projectPath: this.projectPath,
      idea,
      completedStepIds: [],
      outputs: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.saveState(state);
    return state;
  }

  async updateStep(stepId: string, output?: RoleOutput): Promise<WorkflowState> {
    const state = await this.requireState();
    if (output) {
      state.outputs[stepId] = output;
      if (!state.completedStepIds.includes(stepId)) {
        state.completedStepIds.push(stepId);
      }
    }
    await this.saveState(state);
    return state;
  }

  // ──────────────────────────────────────────────
  // CEO 노트
  // ──────────────────────────────────────────────

  async setPreloadedDocs(docs: Array<{ name: string; content: string }>): Promise<void> {
    const state = await this.requireState();
    state.preloadedDocs = docs;
    await this.saveState(state);
  }

  async addCeoNote(afterStepId: string, afterLabel: string, note: string): Promise<void> {
    const notes = await this.loadCeoNotes();
    notes.push({ afterStepId, afterLabel, note, timestamp: new Date().toISOString() });
    await fs.mkdir(path.dirname(this.notesPath), { recursive: true });
    await fs.writeFile(this.notesPath, JSON.stringify(notes, null, 2), 'utf-8');
  }

  async loadCeoNotes(): Promise<CeoNote[]> {
    try {
      const raw = await fs.readFile(this.notesPath, 'utf-8');
      return JSON.parse(raw) as CeoNote[];
    } catch {
      return [];
    }
  }

  // ──────────────────────────────────────────────
  // 컨텍스트 조합: 완료된 스텝 결과물 + CEO 노트 순서대로
  // ──────────────────────────────────────────────

  /**
   * 컨텍스트 문자열 빌드.
   * upToStepId가 주어지면 해당 스텝(포함 X) 직전까지만 포함한다.
   */
  async buildContext(upToStepId?: string): Promise<string> {
    const state = await this.requireState();
    const ceoNotes = await this.loadCeoNotes();

    const parts: string[] = [
      `# 프로젝트: ${state.projectName}`,
      `## 아이디어\n${state.idea}`,
    ];

    // 사전 로드된 문서 포함
    if (state.preloadedDocs && state.preloadedDocs.length > 0) {
      for (const doc of state.preloadedDocs) {
        parts.push(`## 사전 제공 문서: ${doc.name}\n${doc.content}`);
      }
    }

    for (const stepId of state.completedStepIds) {
      if (upToStepId && stepId === upToStepId) break;

      const output = state.outputs[stepId];
      if (output) {
        parts.push(`## ${output.role.toUpperCase()} 결과물`);
        for (const artifact of output.artifacts) {
          parts.push(`### ${artifact.path}\n\`\`\`\n${artifact.content}\n\`\`\``);
        }
      }

      const notes = ceoNotes.filter((n) => n.afterStepId === stepId);
      for (const n of notes) {
        parts.push(`## CEO 지시사항 (${n.afterLabel} 이후)\n> ${n.note}`);
      }
    }

    return parts.join('\n\n');
  }

  private async requireState(): Promise<WorkflowState> {
    const state = await this.loadState();
    if (!state) {
      throw new Error(
        `프로젝트 상태를 찾을 수 없습니다. 'mlc init <project-name>'을 먼저 실행하세요.`
      );
    }
    return state;
  }
}
