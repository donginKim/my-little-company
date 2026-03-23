import inquirer from 'inquirer';
import { Orchestrator, EventBus, createLLMRouterFromConfig } from '@mlc/core';
import { printSuccess, printError, printDiffs, printWarning } from '../utils/display.js';
import { attachLiveDisplay } from '../utils/liveDisplay.js';
import { InterruptManager } from '../utils/InterruptManager.js';
import { loadConfig, resolvePipeline } from '../utils/config.js';

export async function commandPlan(
  idea: string,
  options: { apply?: boolean; watch?: boolean; interactive?: boolean; file?: string }
): Promise<void> {
  const projectPath = process.cwd();
  const config = await loadConfig(projectPath);
  const pipeline = resolvePipeline(config.pipeline ?? []);

  const bus = new EventBus();
  if (options.watch !== false) attachLiveDisplay(bus);

  const interactive = options.interactive !== false && process.stdin.isTTY;
  const interruptMgr = interactive ? new InterruptManager() : undefined;

  if (interactive) {
    printInterruptHint();
  }

  const router = createLLMRouterFromConfig(config.llm, bus);
  const orchestrator = new Orchestrator(
    router,
    { projectPath, readOnly: config.safeMode, stream: true, pipeline },
    bus,
    interruptMgr
  );

  let state = await orchestrator.getState();
  if (!state) {
    printError('프로젝트가 초기화되지 않았습니다. mlc init <project-name>을 먼저 실행하세요.');
    process.exit(1);
  }
  if (idea) state = await orchestrator.initProject(state.projectName, idea);

  if (options.file) {
    const files = options.file.split(',').map((f) => f.trim());
    await orchestrator.loadDocuments(files).catch((err: unknown) => {
      printError(String(err));
      process.exit(1);
    });
    console.log(`  문서 로드 완료: ${files.join(', ')}`);
  }

  // 파이프라인 전체 실행
  const allChanges: any[] = [];
  for (let i = 0; i < pipeline.length; i++) {
    const changes = await orchestrator.runStep(i).catch(handlePipelineError);
    allChanges.push(...changes);
  }

  console.log('');
  printDiffs(allChanges);

  if (options.apply) {
    await applyAndReport(orchestrator, allChanges);
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: `${allChanges.length}개 파일을 적용하겠습니까?`,
    default: true,
  }]);

  if (confirm) {
    await applyAndReport(orchestrator, allChanges);
    console.log('\n다음 단계: mlc run  (개별 스텝 재실행)');
  }
}

async function applyAndReport(orchestrator: Orchestrator, changes: any[]): Promise<void> {
  const result = await orchestrator.applyChanges(changes);
  printSuccess(`적용 완료: ${result.applied.length}개 파일`);
  for (const err of result.errors) printError(`  ${err.path}: ${err.error}`);
}

function handlePipelineError(err: unknown): never {
  const msg = String(err);
  if (msg.includes('중단')) {
    printWarning('파이프라인이 중단되었습니다.');
    process.exit(0);
  }
  printError(msg);
  process.exit(1);
}

function printInterruptHint(): void {
  console.log('');
  console.log('  스트리밍 중 i 키를 누르면 언제든지 개입할 수 있습니다.');
  console.log('  역할 전환 시에도 Enter / i / q 로 제어할 수 있습니다.');
  console.log('');
}
