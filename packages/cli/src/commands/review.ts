import inquirer from 'inquirer';
import { Orchestrator, EventBus, createLLMRouterFromConfig } from '@mlc/core';
import { printError, printSuccess, printDiffs, printWarning } from '../utils/display.js';
import { attachLiveDisplay } from '../utils/liveDisplay.js';
import { InterruptManager } from '../utils/InterruptManager.js';
import { loadConfig, resolvePipeline } from '../utils/config.js';

export async function commandReview(
  options: { apply?: boolean; watch?: boolean; interactive?: boolean }
): Promise<void> {
  const projectPath = process.cwd();
  const config = await loadConfig(projectPath);
  const pipeline = resolvePipeline(config.pipeline ?? []);

  // reviewer 스텝 인덱스 찾기
  const reviewerIndex = pipeline.findIndex((s) => s.role === 'reviewer');
  if (reviewerIndex < 0) {
    printError('pipeline에 reviewer 스텝이 없습니다. mlc.config.yaml을 확인하세요.');
    process.exit(1);
  }

  const bus = new EventBus();
  if (options.watch !== false) attachLiveDisplay(bus);

  const interactive = options.interactive !== false && process.stdin.isTTY;
  const interruptMgr = interactive ? new InterruptManager() : undefined;

  const router = createLLMRouterFromConfig(config.llm, bus);
  const orchestrator = new Orchestrator(
    router,
    { projectPath, readOnly: config.safeMode, stream: true, pipeline },
    bus,
    interruptMgr
  );

  const state = await orchestrator.getState();
  if (!state) { printError('프로젝트가 초기화되지 않았습니다.'); process.exit(1); }

  const changes = await orchestrator.runStep(reviewerIndex).catch((err: unknown) => {
    const msg = String(err);
    if (msg.includes('중단')) { printWarning('파이프라인이 중단되었습니다.'); process.exit(0); }
    printError(msg);
    process.exit(1);
  });

  console.log('');
  printDiffs(changes);

  if (options.apply) {
    const result = await orchestrator.applyChanges(changes);
    printSuccess(`리뷰 보고서 저장: ${result.applied.join(', ')}`);
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: 'review.md를 저장하겠습니까?',
    default: true,
  }]);

  if (confirm) {
    const result = await orchestrator.applyChanges(changes);
    printSuccess(`저장 완료: ${result.applied.join(', ')}`);
  }
}
