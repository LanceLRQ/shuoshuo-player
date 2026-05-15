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

interface MediaLoadingDialogProps {
  /** 是否处于加载中 */
  loading: boolean;
  loaded: number;
  total: number;
  onCancel: () => void;
  /** 对话框标题；默认 "正在加载…" */
  title?: string;
  /** 对话框副标题（说明）；默认风控提示文案 */
  description?: string;
  /** 进度条单位文案（{loaded} / {total} 后缀），默认 "首"。投稿/收藏夹可改 "条" */
  unit?: string;
}

const APPEAR_DELAY_MS = 250;
const DEFAULT_TITLE = '正在加载…';
const DEFAULT_DESCRIPTION = '为避免被 B 站风控，加载速度有所放缓，每页之间会留间隔。';

/**
 * 媒体拉取进度对话框（合集 / UP 主投稿 / 收藏夹通用）。
 *
 * 行为：
 * - loading=true 时延迟 250ms 才显示，避免单页瞬间完成场景闪现
 * - loading 变 false 时立即关闭
 * - 用户点取消 / 遮罩 / ESC 都视作取消（onCancel）
 *
 * 进度条以"已加载 / 总数"为分子分母；total=0（首次拉取尚未拿到 total）时显示"准备中…"。
 */
export function MediaLoadingDialog({
  loading,
  loaded,
  total,
  onCancel,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  unit = '首',
}: MediaLoadingDialogProps) {
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Progress value={percent} />
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `${loaded} / ${total} ${unit}` : '准备中…'}
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

/** @deprecated 兼容别名；新代码请用 MediaLoadingDialog。下一版本周期移除 */
export const CollectionLoadingDialog = MediaLoadingDialog;
