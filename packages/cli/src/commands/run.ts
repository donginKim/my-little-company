import inquirer from 'inquirer';
import { Orchestrator, EventBus, createLLMRouterFromConfig } from '@mlc/core';
import { printError, printSuccess, printDiffs, printWarning, printTaskList } from '../utils/display.js';
import { attachLiveDisplay } from '../utils/liveDisplay.js';
import { InterruptManager } from '../utils/InterruptManager.js';
import { loadConfig, resolvePipeline } from '../utils/config.js';

export async function commandRun(
  stepRef: string | undefined,
  options: { all?: boolean; apply?: boolean; watch?: boolean; interactive?: boolean }
): Promise<void> {
  const projectPath = process.cwd();
  const config = await loadConfig(projectPath);
  const pipeline = resolvePipeline(config.pipeline ?? []);

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

  const tasks = await orchestrator.getTasks();
  if (tasks.length > 0) printTaskList(tasks);

  if (options.all) {
    // 남은 모든 스텝 실행
    let idx = await orchestrator.getNextStepIndex();
    const allChanges: any[] = [];
    while (idx >= 0) {
      const changes = await orchestrator.runStep(idx).catch(handlePipelineError);
      allChanges.push(...changes);
      idx = await orchestrator.getNextStepIndex();
    }
    console.log('');
    printDiffs(allChanges);
    if (options.apply) {
      const result = await orchestrator.applyChanges(allChanges);
      printSuccess(`적용 완료: ${result.applied.length}개 파일`);
    } else {
      await confirmAndApply(orchestrator, allChanges);
    }
    return;
  }

  // 특정 스텝 또는 다음 스텝 실행
  let stepIndex: number;
  if (stepRef !== undefined) {
    // "pm-1", "architect-1" 형식의 ID 또는 숫자 인덱스
    const byId = pipeline.findIndex((s) => s.id === stepRef);
    stepIndex = byId >= 0 ? byId : parseInt(stepRef, 10);
    if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= pipeline.length) {
      printError(`스텝 '${stepRef}'을 찾을 수 없습니다. mlc status로 스텝 목록을 확인하세요.`);
      process.exit(1);
    }
  } else {
    stepIndex = await orchestrator.getNextStepIndex();
    if (stepIndex < 0) {
      printSuccess('모든 파이프라인 스텝이 완료되었습니다.');
      return;
    }
  }

  const changes = await orchestrator.runStep(stepIndex).catch(handlePipelineError);
  console.log('');
  printDiffs(changes);

  if (options.apply) {
    const result = await orchestrator.applyChanges(changes);
    printSuccess(`적용 완료: ${result.applied.length}개 파일`);
  } else {
    await confirmAndApply(orchestrator, changes);
  }
}

async function confirmAndApply(orchestrator: Orchestrator, changes: any[]): Promise<void> {
  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: `${changes.length}개 파일을 적용하겠습니까?`,
    default: true,
  }]);
  if (confirm) {
    const result = await orchestrator.applyChanges(changes);
    printSuccess(`적용 완료: ${result.applied.length}개 파일`);
  }
}

function handlePipelineError(err: unknown): never {
  const msg = String(err);
  if (msg.includes('중단')) { printWarning('파이프라인이 중단되었습니다.'); process.exit(0); }
  printError(msg);
  process.exit(1);
}
