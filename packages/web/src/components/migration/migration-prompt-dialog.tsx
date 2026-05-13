import { useState } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { NoticeType, useUIStore, type ParsedImport } from '@shuoshuo-player/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportV1Backup } from '@/lib/v1-migration';

interface MigrationPromptDialogProps {
  /** 检测到的 v1 数据原始快照（用于「下载备份」全量导出） */
  rawV1Data: Record<string, unknown>;
  /** parseImportData 解析后的摘要（用于显示数量） */
  parsed: ParsedImport;
  onConfirmImport: () => void;
  onPostpone: () => void;
  onDismiss: () => void;
}

/**
 * v1 → v2 迁移主提示弹层
 *
 * 强制约束：
 * - 不可外点关闭（onPointerDownOutside / onInteractOutside preventDefault）
 * - 不可 Esc 关闭（onEscapeKeyDown preventDefault）
 * - 隐藏右上角 X（[&>button]:hidden 精准命中 DialogContent 直接子 button）
 *
 * 用户路径：
 * - 下载 v1 备份：随时可点；强烈建议先备份再做后续操作（醒目提示）
 * - 立即导入 → ImportDataDialog 主流程
 * - 稍后再说 → 关闭弹层但保留 v1 数据，下次启动重新触发
 * - 永久放弃 → 二次确认弹层（带导出备份兜底）
 */
export function MigrationPromptDialog({
  rawV1Data,
  parsed,
  onConfirmImport,
  onPostpone,
  onDismiss,
}: MigrationPromptDialogProps) {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [exporting, setExporting] = useState(false);

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

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="flex max-w-lg flex-col gap-4 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1.5">
          <DialogTitle>检测到旧版数据</DialogTitle>
          <DialogDescription>
            说说播放器升级到了 v2，检测到你浏览器里还保留着 v1 旧版本的数据。请选择如何处理：
          </DialogDescription>
        </DialogHeader>

        {/* 数据预览：歌单 / 歌词 / 视频缓存 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">歌单</span>
            <Badge variant="secondary" className="text-xs">
              {parsed.favList.length}
            </Badge>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">歌词</span>
            <Badge variant="secondary" className="text-xs">
              {parsed.lyricCount}
            </Badge>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">视频缓存</span>
            <Badge variant="secondary" className="text-xs">
              {parsed.videoCount}
            </Badge>
          </span>
        </div>

        {/* 强烈建议：先导出备份 —— 黄色警示框 */}
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 space-y-1.5">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              强烈建议先导出旧数据备份
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              在做任何操作之前，请先点下方「下载 v1
              备份」把旧数据保存到本地。万一迁移出现意外，备份可以让你把数据恢复到 v1
              旧版本或重新导入。
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBackup}
              disabled={exporting}
              className="mt-1 h-7 gap-1.5 border-amber-400 bg-white hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/60"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? '正在导出…' : '下载 v1 备份'}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          说明：v1 的云账户登录态不会随这次迁移搬过来，需要重新登录云服务。B 站登录由浏览器 Cookie
          管理，不受影响。
        </p>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            永久放弃
          </Button>
          <Button variant="outline" size="sm" onClick={onPostpone}>
            稍后再说
          </Button>
          <Button size="sm" onClick={onConfirmImport}>
            立即导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
