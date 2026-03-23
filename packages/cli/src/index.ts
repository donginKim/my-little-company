#!/usr/bin/env node
import { Command } from 'commander';
import { commandInit } from './commands/init.js';
import { commandPlan } from './commands/plan.js';
import { commandRun } from './commands/run.js';
import { commandReview } from './commands/review.js';
import { commandApply } from './commands/apply.js';
import { commandDashboard } from './commands/dashboard.js';
import { printError } from './utils/display.js';

const program = new Command();

program
  .name('mlc')
  .description('My Little Company - AI-powered solo development studio')
  .version('0.1.0');

// ── mlc init <project-name> ──
program
  .command('init <project-name>')
  .description('새 프로젝트를 초기화합니다')
  .option('-i, --idea <idea>', '초기 아이디어 설명')
  .action(async (projectName: string, options) => {
    await commandInit(projectName, options).catch(handleError);
  });

// ── mlc plan "<idea>" ──
program
  .command('plan [idea]')
  .description('파이프라인 전체를 실행합니다 (config의 pipeline 순서대로)')
  .option('--apply', '확인 없이 바로 적용')
  .option('--file <path>', '기존 문서를 로드하여 PM이 검수 모드로 동작 (콤마로 여러 파일 지정)')
  .action(async (idea: string, options) => {
    await commandPlan(idea ?? '', options).catch(handleError);
  });

// ── mlc run [step-id] ──
program
  .command('run [step-ref]')
  .description('다음 pending 스텝 또는 지정한 스텝을 실행합니다')
  .option('--all', '남은 모든 스텝 실행')
  .option('--apply', '확인 없이 바로 적용')
  .action(async (stepRef: string | undefined, options) => {
    await commandRun(stepRef, options).catch(handleError);
  });

// ── mlc review ──
program
  .command('review')
  .description('pipeline의 reviewer 스텝을 실행합니다')
  .option('--apply', '리뷰 보고서를 바로 저장')
  .action(async (options) => {
    await commandReview(options).catch(handleError);
  });

// ── mlc apply ──
program
  .command('apply')
  .description('대기 중인 변경사항을 적용합니다')
  .action(async () => {
    await commandApply().catch(handleError);
  });

// ── mlc dashboard ──
program
  .command('dashboard')
  .description('웹 대시보드를 시작합니다')
  .option('-p, --port <number>', '포트 번호 (기본값: 3000)', '3000')
  .option('--no-open', '브라우저 자동 실행 안 함')
  .action(async (options) => {
    await commandDashboard(options).catch(handleError);
  });

// ── mlc status ──
program
  .command('status')
  .description('현재 파이프라인 상태를 표시합니다')
  .action(async () => {
    const { createLLMRouterFromConfig, Orchestrator } = await import('@mlc/core');
    const { loadConfig, resolvePipeline } = await import('./utils/config.js');
    const { printInfo, printStep, printError: pe, printSuccess: ps, printWarning: pw } = await import('./utils/display.js');
    const { printTaskList } = await import('./utils/display.js');

    const projectPath = process.cwd();
    const config = await loadConfig(projectPath);
    const pipeline = resolvePipeline(config.pipeline ?? []);

    const router = createLLMRouterFromConfig(config.llm);
    const orchestrator = new Orchestrator(router, { projectPath, pipeline });

    const state = await orchestrator.getState();
    if (!state) {
      pe('초기화된 프로젝트가 없습니다. mlc init <project-name>을 실행하세요.');
      return;
    }

    printStep('STATUS', state.projectName);
    printInfo(`아이디어: ${state.idea}`);
    printInfo(`완료된 스텝: ${state.completedStepIds.join(' → ') || '없음'}`);

    console.log('\n파이프라인:');
    const completedSet = new Set(state.completedStepIds);
    for (let i = 0; i < pipeline.length; i++) {
      const step = pipeline[i];
      const done = completedSet.has(step.id);
      const marker = done ? ps : pw;
      console.log(`  ${i + 1}. [${done ? '✓' : ' '}] ${step.id}  (${step.role}${step.provider ? ` · ${step.provider}` : ''})`);
    }

    const tasks = await orchestrator.getTasks();
    if (tasks.length > 0) {
      printTaskList(tasks);
    }
  });

// ── mlc providers ──
program
  .command('providers')
  .description('사용 가능한 LLM 프로바이더를 표시합니다')
  .action(async () => {
    const { createLLMRouterFromConfig } = await import('@mlc/core');
    const { loadConfig } = await import('./utils/config.js');
    const { printInfo, printSuccess, printWarning } = await import('./utils/display.js');

    const config = await loadConfig();
    const router = createLLMRouterFromConfig(config.llm);

    const registered = router.listRegistered();
    const available = await router.listAvailable();

    console.log('\n등록된 프로바이더:');
    for (const name of registered) {
      if (available.includes(name)) {
        printSuccess(`${name} (사용 가능)`);
      } else {
        printWarning(`${name} (사용 불가 - API 키 또는 서버 확인 필요)`);
      }
    }

    printInfo(`\n기본 프로바이더: ${config.llm.defaultProvider}`);
  });

program.parse(process.argv);

function handleError(err: unknown): void {
  printError(String(err));
  process.exit(1);
}
