import http from 'http';
import fs from 'fs/promises';
import { watch } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { loadConfig, resolvePipeline } from './config.js';
import { getDashboardHtml } from './dashboardHtml.js';
import {
  Orchestrator,
  EventBus,
  createLLMRouterFromConfig,
} from '@mlc/core';
import type { FileChange, InterruptAdapter } from '@mlc/core';

// ──────────────────────────────────────────────────────────────────
// WebInterruptAdapter
// Implements InterruptAdapter using HTTP+SSE instead of stdin/raw mode
// ──────────────────────────────────────────────────────────────────

class WebInterruptAdapter implements InterruptAdapter {
  private abortController = new AbortController();
  private onInterruptCb: (() => void) | null = null;
  private checkpointResolver:
    | ((r: { decision: 'continue' | 'note' | 'abort'; note?: string }) => void)
    | null = null;
  private noteResolver: ((note: string) => void) | null = null;
  private _broadcast: (data: object) => void;

  constructor(broadcast: (data: object) => void) {
    this._broadcast = broadcast;
  }

  get signal() {
    return this.abortController.signal;
  }

  reset() {
    this.abortController = new AbortController();
  }

  startListening(onInterrupt: () => void) {
    this.onInterruptCb = onInterrupt;
  }

  stopListening() {
    this.onInterruptCb = null;
  }

  async checkpoint(
    _completedStepId: string,
    completedLabel: string,
    _nextStepId: string,
    nextLabel: string
  ): Promise<{ decision: 'continue' | 'note' | 'abort'; note?: string }> {
    this._broadcast({ type: 'checkpoint', completedLabel, nextLabel });
    return new Promise((resolve) => {
      this.checkpointResolver = resolve;
    });
  }

  resolveCheckpoint(decision: 'continue' | 'note' | 'abort', note?: string) {
    this.checkpointResolver?.({ decision, note });
    this.checkpointResolver = null;
  }

  async collectNote(prompt?: string): Promise<string> {
    this._broadcast({ type: 'collect:note', prompt: prompt ?? '지시사항을 입력하세요' });
    return new Promise((resolve) => {
      this.noteResolver = resolve;
    });
  }

  resolveNote(note: string) {
    this.noteResolver?.(note);
    this.noteResolver = null;
  }

  triggerInterrupt() {
    this.abortController.abort();
    this.onInterruptCb?.();
  }

  get isWaitingForNote() {
    return this.noteResolver !== null;
  }
  get isWaitingForCheckpoint() {
    return this.checkpointResolver !== null;
  }
}

// ──────────────────────────────────────────────────────────────────
// Dashboard HTTP Server
// ──────────────────────────────────────────────────────────────────

export async function startDashboardServer(
  projectPath: string,
  port: number,
  autoOpen: boolean
): Promise<void> {
  // allow port to be reassigned if EADDRINUSE
  let _port = port;
  const mlcDir = path.join(projectPath, '.mlc');
  const sseClients = new Set<http.ServerResponse>();

  let isRunning = false;
  let pendingChanges: FileChange[] | null = null;
  let applyResolver: ((d: 'apply' | 'reject') => void) | null = null;

  const bus = new EventBus();
  const webInterrupt = new WebInterruptAdapter(broadcast);

  // Bridge every EventBus event → all SSE clients
  bus.subscribe((event) => broadcast(event));

  function broadcast(data: object) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(msg);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  async function createOrchestrator() {
    const cfg = await loadConfig(projectPath);
    const resolved = resolvePipeline(cfg.pipeline ?? []);
    const router = createLLMRouterFromConfig(cfg.llm, bus);
    return new Orchestrator(
      router,
      { projectPath, pipeline: resolved, stream: true },
      bus,
      webInterrupt
    );
  }

  async function handleChanges(
    orchestrator: Orchestrator,
    changes: FileChange[]
  ): Promise<void> {
    if (!changes.length) return;
    pendingChanges = changes;
    broadcast({
      type: 'changes:pending',
      changes: changes.map((c) => ({
        path: c.path,
        changeType: c.type,
        diff: c.diff ?? null,
        preview: c.content?.slice(0, 3000) ?? null,
      })),
    });
    const decision = await new Promise<'apply' | 'reject'>((resolve) => {
      applyResolver = resolve;
    });
    if (decision === 'apply') {
      await orchestrator.applyChanges(changes);
      broadcast({ type: 'changes:applied', count: changes.length });
    } else {
      broadcast({ type: 'changes:rejected' });
    }
    pendingChanges = null;
    applyResolver = null;
  }

  async function runInBackground(
    mode: 'all' | 'next',
    stepRef?: string
  ): Promise<void> {
    if (isRunning) {
      broadcast({ type: 'error', message: '이미 실행 중입니다' });
      return;
    }
    isRunning = true;
    broadcast({ type: 'run:start', mode });

    try {
      const orchestrator = await createOrchestrator();

      if (mode === 'all') {
        let nextIdx = await orchestrator.getNextStepIndex();
        if (nextIdx < 0) {
          broadcast({ type: 'pipeline:already_complete' });
          return;
        }
        while (nextIdx >= 0) {
          const changes = await orchestrator.runStep(nextIdx);
          await handleChanges(orchestrator, changes);
          broadcast({ type: 'state:refresh' });
          nextIdx = await orchestrator.getNextStepIndex();
        }
      } else {
        let stepIdx: number;
        if (stepRef !== undefined) {
          const cfg = await loadConfig(projectPath);
          const pl = resolvePipeline(cfg.pipeline ?? []);
          const byId = pl.findIndex((s) => s.id === stepRef);
          stepIdx = byId >= 0 ? byId : parseInt(stepRef, 10);
        } else {
          stepIdx = await orchestrator.getNextStepIndex();
        }
        if (stepIdx < 0) {
          broadcast({ type: 'pipeline:already_complete' });
          return;
        }
        const changes = await orchestrator.runStep(stepIdx);
        await handleChanges(orchestrator, changes);
        broadcast({ type: 'state:refresh' });
      }

      broadcast({ type: 'pipeline:complete' });
    } catch (err) {
      const msg = String(err);
      if (msg.includes('중단')) {
        broadcast({ type: 'pipeline:aborted' });
      } else {
        broadcast({ type: 'pipeline:error', message: msg });
      }
    } finally {
      isRunning = false;
      pendingChanges = null;
      applyResolver = null;
    }
  }

  // ── HTTP request handler ──────────────────────────────────────

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── GET ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
      try {
        if (url.pathname === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getDashboardHtml(port));
          return;
        }

        if (url.pathname === '/api/state') {
          respondJson(res, await readJson(path.join(mlcDir, 'state.json')));
          return;
        }
        if (url.pathname === '/api/tasks') {
          respondJson(res, await readJson(path.join(mlcDir, 'tasks.json')));
          return;
        }
        if (url.pathname === '/api/notes') {
          respondJson(res, (await readJson(path.join(mlcDir, 'ceo-notes.json'))) ?? []);
          return;
        }
        if (url.pathname === '/api/pipeline') {
          try {
            const cfg = await loadConfig(projectPath);
            respondJson(res, resolvePipeline(cfg.pipeline ?? []));
          } catch {
            respondJson(res, []);
          }
          return;
        }
        if (url.pathname === '/api/status') {
          respondJson(res, {
            isRunning,
            hasPendingChanges: pendingChanges !== null,
            isWaitingCheckpoint: webInterrupt.isWaitingForCheckpoint,
            isWaitingNote: webInterrupt.isWaitingForNote,
          });
          return;
        }
        if (url.pathname === '/api/config/raw') {
          const cfgPath = path.join(projectPath, 'mlc.config.yaml');
          try {
            const content = await fs.readFile(cfgPath, 'utf-8');
            respondJson(res, { content, path: cfgPath });
          } catch {
            respondJson(res, { content: '', path: cfgPath });
          }
          return;
        }

        if (url.pathname === '/api/config/parsed') {
          try {
            const cfg = await loadConfig(projectPath);
            respondJson(res, cfg);
          } catch {
            respondJson(res, null);
          }
          return;
        }

        if (url.pathname === '/api/artifact') {
          const filePath = url.searchParams.get('path');
          if (!filePath) {
            res.writeHead(400);
            res.end('missing path');
            return;
          }
          const abs = path.resolve(projectPath, filePath);
          if (!abs.startsWith(path.resolve(projectPath))) {
            res.writeHead(403);
            res.end('forbidden');
            return;
          }
          try {
            const content = await fs.readFile(abs, 'utf-8');
            respondJson(res, { content });
          } catch {
            res.writeHead(404);
            res.end('not found');
          }
          return;
        }

        // SSE stream
        if (url.pathname === '/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          res.write('data: {"type":"connected"}\n\n');
          sseClients.add(res);

          let debounce: ReturnType<typeof setTimeout> | null = null;
          let watcher: ReturnType<typeof watch> | null = null;
          try {
            watcher = watch(mlcDir, { recursive: true }, (_evt, fname) => {
              if (!fname || fname.includes('events')) return;
              if (isRunning) return; // let EventBus handle it during run
              if (debounce) clearTimeout(debounce);
              debounce = setTimeout(
                () => broadcast({ type: 'state:refresh' }),
                500
              );
            });
          } catch {
            /* .mlc not yet created */
          }

          const heartbeat = setInterval(() => {
            try {
              res.write(': ping\n\n');
            } catch {
              /* ignore */
            }
          }, 15000);

          req.on('close', () => {
            sseClients.delete(res);
            clearInterval(heartbeat);
            if (debounce) clearTimeout(debounce);
            watcher?.close();
          });
          return;
        }

        res.writeHead(404);
        res.end('not found');
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
      return;
    }

    // ── POST ─────────────────────────────────────────────────────
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        let payload: Record<string, any> = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          /* ignore */
        }

        try {
          if (url.pathname === '/api/run/start') {
            runInBackground(payload.mode ?? 'all', payload.stepRef); // not awaited
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/run/abort') {
            webInterrupt.triggerInterrupt();
            webInterrupt.resolveCheckpoint('abort');
            applyResolver?.('reject');
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/run/apply') {
            applyResolver?.(payload.decision === 'apply' ? 'apply' : 'reject');
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/run/checkpoint') {
            webInterrupt.resolveCheckpoint(payload.decision ?? 'continue', payload.note);
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/run/interrupt') {
            if (isRunning && !webInterrupt.isWaitingForNote) {
              webInterrupt.triggerInterrupt();
            }
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/run/collect-note') {
            webInterrupt.resolveNote(payload.note ?? '');
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/config/save') {
            const cfgPath = path.join(projectPath, 'mlc.config.yaml');
            await fs.writeFile(cfgPath, payload.content ?? '', 'utf-8');
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/config/save-json') {
            const cfgPath = path.join(projectPath, 'mlc.config.yaml');
            const yamlStr = yaml.dump(payload, { lineWidth: 120 });
            await fs.writeFile(cfgPath, '# mlc.config.yaml\n' + yamlStr, 'utf-8');
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/project/init') {
            const { projectName, idea } = payload;
            if (!projectName || !idea) {
              res.writeHead(400);
              res.end('projectName and idea required');
              return;
            }
            const orch = await createOrchestrator();
            await orch.initProject(String(projectName), String(idea));
            broadcast({ type: 'state:refresh' });
            respondJson(res, { ok: true });
            return;
          }

          if (url.pathname === '/api/state/reset') {
            const stateFile = path.join(mlcDir, 'state.json');
            try {
              const raw = await fs.readFile(stateFile, 'utf-8');
              const state = JSON.parse(raw);
              state.completedStepIds = [];
              state.outputs = {};
              await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
            } catch {
              /* state.json 없으면 무시 */
            }
            broadcast({ type: 'state:refresh' });
            respondJson(res, { ok: true });
            return;
          }

          res.writeHead(404);
          res.end('not found');
        } catch (err) {
          res.writeHead(500);
          res.end(String(err));
        }
      });
      return;
    }

    res.writeHead(405);
    res.end('method not allowed');
  });

  await new Promise<void>((resolve, reject) => {
    function tryListen(p: number) {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`  포트 ${p} 사용 중 → ${p + 1}으로 재시도...`);
          tryListen(p + 1);
        } else {
          reject(err);
        }
      });
      server.listen(p, '127.0.0.1', () => {
        _port = p;
        resolve();
      });
    }
    tryListen(_port);
  });

  const url = `http://localhost:${_port}`;
  console.log('');
  console.log(`  대시보드 실행 중: ${url}`);
  console.log('  종료: Ctrl+C');
  console.log('');
  if (autoOpen) openBrowser(url);
}

function respondJson(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function openBrowser(url: string): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { exec } = require('child_process');
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
      ? `start "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* ignore errors */
  });
}
