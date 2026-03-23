import fs from 'fs/promises';
import path from 'path';
import { Orchestrator, EventBus, createLLMRouterFromConfig } from '@mlc/core';
import { printBanner, printSuccess, printError } from '../utils/display.js';
import { loadConfig, writeDefaultConfig } from '../utils/config.js';

export async function commandInit(projectName: string, options: { idea?: string }): Promise<void> {
  printBanner();

  const projectPath = path.resolve(process.cwd(), projectName);

  try {
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'docs'), { recursive: true });
    await fs.mkdir(path.join(projectPath, '.mlc'), { recursive: true });
  } catch (err) {
    printError(`디렉터리 생성 실패: ${err}`);
    process.exit(1);
  }

  await writeDefaultConfig(projectPath);

  const config = await loadConfig(projectPath);
  const bus = new EventBus();
  const router = createLLMRouterFromConfig(config.llm, bus);
  const orchestrator = new Orchestrator(router, { projectPath }, bus);

  await orchestrator.initProject(projectName, options.idea ?? '');

  await fs.writeFile(
    path.join(projectPath, 'README.md'),
    `# ${projectName}\n\n> ${options.idea || 'My Little Company로 만든 프로젝트'}\n\n## 시작하기\n\n\`\`\`bash\ncd ${projectName}\nmlc plan "<아이디어 설명>"\n\`\`\`\n`,
    'utf-8'
  );

  printSuccess(`프로젝트 생성 완료: ${projectPath}`);
  printSuccess(`설정 파일: ${path.join(projectPath, 'mlc.config.json')}`);
  console.log(`\n다음 단계:\n  cd ${projectName}\n  mlc plan "<아이디어 설명>"`);
}
