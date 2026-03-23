import { startDashboardServer } from '../utils/dashboardServer.js';

export async function commandDashboard(
  options: { port?: number; no_open?: boolean }
): Promise<void> {
  const projectPath = process.cwd();
  const port = options.port ? parseInt(String(options.port), 10) : 3000;
  const autoOpen = !options.no_open;

  await startDashboardServer(projectPath, port, autoOpen);

  // Keep process alive
  await new Promise(() => {});
}
