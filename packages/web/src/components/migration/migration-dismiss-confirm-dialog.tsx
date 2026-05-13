import { useState } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { NoticeType, useUIStore } from '@shuoshuo-player/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { dismissV1Migration, exportV1Backup } from '@/lib/v1-migration';

interface MigrationDismissConfirmDialogProps {
  rawV1Data: Record<string, unknown>;
  onCancel: () => void;
  onConfirmed: () => void;
}

/**
 * 永久放弃迁移的二次确认弹层
 *
 * 强制约束（同 MigrationPromptDialog）：不可外点 / Esc / X 关闭
 *
 * 「先下载备份」点击后不关闭弹层，让用户备份完成后再决定是否真正放弃；
 * 「确认放弃」会写入 dismissed 标志 + 删除 7 个 v1 key（dismissV1Migration 内已保证顺序）
 */
export function MigrationDismissConfirmDialog({
  rawV1Data,
  onCancel,
  onConfirmed,
}: MigrationDismissConfirmDialogProps) {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [exporting, setExporting] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const handleExportBackup = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportV1Backup(rawV1Data);
      sendNotice({ type: NoticeType.SUCCESS, message: '备份已下载', duration: 2000 });
    } catch (err) {
      console.debug('[v1-migration] export backup failed', err);
      sendNotice({ type: NoticeType.ERROR, message: '备份下载失败，请重试', duration: 3000 });
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmDismiss = async () => {
    if (dismissing) return;
    setDismissing(true);
    try {
      await dismissV1Migration();
      onConfirmed();
    } catch (err) {
      console.debug('[v1-migration] dismiss failed', err);
      sendNotice({ type: NoticeType.ERROR, message: '操作失败，请重试', duration: 3000 });
      setDismissing(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="flex max-w-md flex-col gap-4 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            确认永久放弃旧数据？
          </DialogTitle>
          <DialogDescription>
            一旦确认，浏览器里 v1
            留下的所有数据将被立即清除，并且下次启动也不会再提醒。这个操作无法撤销。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            强烈建议先下载一份备份再放弃
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            备份是一个 JSON 文件，保存在本地后随时可以通过「设置 → 导入数据」找回。
          </p>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportBackup}
            disabled={exporting || dismissing}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? '正在导出…' : '先下载备份'}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={dismissing}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDismiss}
              disabled={dismissing}
            >
              {dismissing ? '正在清理…' : '确认放弃'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
