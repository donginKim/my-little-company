import { EventEmitter } from 'events';
import type { RoleName } from '../types/index.js';

// ──────────────────────────────────────────────
// 이벤트 타입 정의
// ──────────────────────────────────────────────

export type MlcEvent =
  | { type: 'role:start';    role: RoleName; stepId: string; stepLabel: string }
  | { type: 'role:complete'; role: RoleName; stepId: string; stepLabel: string; summary: string }
  | { type: 'role:error';    role: RoleName; stepId: string; error: string }
  | { type: 'llm:request';   role: RoleName; stepId: string; provider: string; model: string }
  | { type: 'llm:token';     token: string }
  | { type: 'llm:response';  usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: 'context:transfer'; fromId: string; fromLabel: string; toId: string; toLabel: string; length: number; preview: string }
  | { type: 'artifact:save'; role: RoleName; stepId: string; filePath: string; fileType: string }
  | { type: 'ceo:interrupt'; note: string; afterStepId: string; afterLabel: string }
  | { type: 'ceo:checkpoint'; nextStepId: string; nextLabel: string }
  | { type: 'pipeline:abort' };

export type MlcEventType = MlcEvent['type'];

// ──────────────────────────────────────────────
// EventBus
// ──────────────────────────────────────────────

export class EventBus extends EventEmitter {
  /** 이벤트 발행 */
  publish(payload: MlcEvent): void {
    this.emit('mlc', payload);
  }

  /** 이벤트 구독 */
  subscribe(listener: (payload: MlcEvent) => void): this {
    return this.on('mlc', listener);
  }

  /** 구독 해제 */
  unsubscribe(listener: (payload: MlcEvent) => void): this {
    return this.off('mlc', listener);
  }
}

export const globalBus = new EventBus();
