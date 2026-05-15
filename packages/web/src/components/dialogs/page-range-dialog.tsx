import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface PageRangeDialogProps {
  open: boolean;
  /** 远端总页数，用于校验上限与展示文案 */
  totalPages: number;
  /** 每页条数，仅用于"预计加载 N 条"文案；默认 30 */
  pageSize?: number;
  /** 起始页默认值；默认 1 */
  defaultFrom?: number;
  /** 结束页默认值；默认 min(5, totalPages) */
  defaultTo?: number;
  /** 对话框标题；默认 "按范围拉取" */
  title?: string;
  onConfirm: (fromPage: number, toPage: number) => void;
  onCancel: () => void;
}

/** 串行节奏估算：单页 HTTP 约 300ms 网络 + 300ms 间隔 */
const PER_PAGE_SECONDS = 0.6;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 按页范围拉取对话框。
 *
 * 用户输入起始页 / 结束页（自动校验 1 ≤ from ≤ to ≤ totalPages），
 * 实时显示预计加载条数与耗时，确认后回调 onConfirm(fromPage, toPage)。
 *
 * UP 主投稿、收藏夹、合集三处共用。
 */
export function PageRangeDialog({
  open,
  totalPages,
  pageSize = 30,
  defaultFrom = 1,
  defaultTo,
  title = '按范围拉取',
  onConfirm,
  onCancel,
}: PageRangeDialogProps) {
  const safeTotal = Math.max(1, totalPages);
  const initialFrom = clamp(defaultFrom, 1, safeTotal);
  const initialTo = clamp(defaultTo ?? Math.min(5, safeTotal), initialFrom, safeTotal);
  const [from, setFrom] = useState<number>(initialFrom);
  const [to, setTo] = useState<number>(initialTo);

  // open 切换时重置（每次打开都回到默认值）
  useEffect(() => {
    if (open) {
      setFrom(initialFrom);
      setTo(initialTo);
    }
    // 仅 open 变化时触发；defaultFrom/defaultTo 通常稳定，不进 deps 防多次重置
  }, [open]);

  const validFrom = clamp(Number.isFinite(from) ? from : 1, 1, safeTotal);
  const validTo = clamp(Number.isFinite(to) ? to : validFrom, validFrom, safeTotal);
  const pages = validTo - validFrom + 1;
  const estimateCount = pages * pageSize;
  const estimateSeconds = Math.ceil(pages * PER_PAGE_SECONDS);
  const invalid = validFrom > validTo || pages <= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onCancel())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            共 {safeTotal} 页，每页约 {pageSize} 条。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="page-range-from" className="text-xs">
              起始页
            </Label>
            <Input
              id="page-range-from"
              type="number"
              min={1}
              max={safeTotal}
              value={from}
              onChange={(e) => setFrom(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="page-range-to" className="text-xs">
              结束页
            </Label>
            <Input
              id="page-range-to"
              type="number"
              min={1}
              max={safeTotal}
              value={to}
              onChange={(e) => setTo(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {invalid
            ? '起始页需小于或等于结束页'
            : `预计加载约 ${estimateCount} 条，耗时约 ${estimateSeconds} 秒`}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button disabled={invalid} onClick={() => onConfirm(validFrom, validTo)}>
            开始
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
