import { useV1MigrationStore } from '@/stores/v1-migration-store';
import { ChoosingFlow } from './choosing-flow';
import { MigrationDismissConfirmDialog } from './migration-dismiss-confirm-dialog';
import { MigrationPromptDialog } from './migration-prompt-dialog';

/**
 * v1 → v2 迁移流程总入口（挂在 App.tsx 顶层）
 *
 * 根据 useV1MigrationStore.status 选择渲染哪个子弹层：
 * - prompt      → 主提示三选一
 * - choosing    → 复用 ImportDataDialog 选歌单 + 合并模式
 * - dismissing  → 永久放弃二次确认
 * - 其他        → null（idle / completed / dismissed 不渲染）
 *
 * idle 状态下 store 已释放 rawV1Data + parsed，组件守卫不会渲染脏弹层。
 */
export function MigrationGate() {
  const status = useV1MigrationStore((s) => s.status);
  const rawV1Data = useV1MigrationStore((s) => s.rawV1Data);
  const parsed = useV1MigrationStore((s) => s.parsed);
  const startChoosing = useV1MigrationStore((s) => s.startChoosing);
  const cancelChoosing = useV1MigrationStore((s) => s.cancelChoosing);
  const startDismissing = useV1MigrationStore((s) => s.startDismissing);
  const cancelDismissing = useV1MigrationStore((s) => s.cancelDismissing);
  const postpone = useV1MigrationStore((s) => s.postpone);
  const markCompleted = useV1MigrationStore((s) => s.markCompleted);
  const markDismissed = useV1MigrationStore((s) => s.markDismissed);

  // 守卫：缺数据时不渲染，避免脏状态
  if (!rawV1Data || !parsed) return null;

  if (status === 'prompt') {
    return (
      <MigrationPromptDialog
        rawV1Data={rawV1Data}
        parsed={parsed}
        onConfirmImport={startChoosing}
        onPostpone={postpone}
        onDismiss={startDismissing}
      />
    );
  }

  if (status === 'choosing') {
    return <ChoosingFlow parsed={parsed} onCancel={cancelChoosing} onCompleted={markCompleted} />;
  }

  if (status === 'dismissing') {
    return (
      <MigrationDismissConfirmDialog
        rawV1Data={rawV1Data}
        onCancel={cancelDismissing}
        onConfirmed={markDismissed}
      />
    );
  }

  return null;
}
