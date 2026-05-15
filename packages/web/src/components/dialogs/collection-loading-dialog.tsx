import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface CollectionLoadingDialogProps {
  /** 是否处于加载中（外部 useCollectionAllArchives.isLoading 直接传入即可） */
  loading: boolean;
  loaded: number;
  total: number;
  onCancel: () => void;
}

const APPEAR_DELAY_MS = 250;

/**
 * 合集拉取进度对话框。
 *
 * 行为：
 * - loading=true 时延迟 250ms 才显示，避免单页瞬间完成的场景闪现
 * - loading 变 false 时立即关闭
 * - 用户点取消 / 遮罩 / ESC 都视作取消（onCancel）
 *
 * 进度条以"已加载 / 总数"为分子分母；total=0（首次拉取尚未拿到 total）时显示不确定态。
 */
export function CollectionLoadingDialog({
  loading,
  loaded,
  total,
  onCancel,
}: CollectionLoadingDialogProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;

  return (
    <Dialog open={visible} onOpenChange={(o) => (o ? null : onCancel())}>
      <DialogContent
        className="sm:max-w-sm"
        // 点遮罩 / ESC 走 onOpenChange → onCancel；阻止 close 按钮（DialogContent 自带的 X）走 onOpenChange 是默认行为
      >
        <DialogHeader>
          <DialogTitle>正在加载合集…</DialogTitle>
          <DialogDescription>
            为避免被 B 站风控，加载速度有所放缓，每页之间会留 200ms 间隔。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Progress value={percent} />
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `${loaded} / ${total} 首` : '准备中…'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
