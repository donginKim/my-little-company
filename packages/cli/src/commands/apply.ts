import { printStep, printError, printInfo } from '../utils/display.js';

/**
 * mlc apply: 이전 단계에서 저장된 pending 변경사항을 적용
 * 현재는 plan/run/review 명령에 --apply 플래그 또는 인터랙티브 확인으로 처리됨
 * 이 명령은 향후 staged changes 기능을 위해 예약됨
 */
export async function commandApply(): Promise<void> {
  printStep('APPLY', '변경사항 적용');
  printInfo('mlc apply는 아직 개발 중입니다.');
  printInfo('현재는 plan / run / review 명령 실행 후 인터랙티브 확인을 사용하거나,');
  printInfo('--apply 플래그를 사용하세요.\n');
  printInfo('예시:');
  printInfo('  mlc plan "아이디어" --apply');
  printInfo('  mlc run task-001 --apply');
  printInfo('  mlc review --apply');
}
