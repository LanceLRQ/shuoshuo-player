import { useEffect, useMemo, useState } from 'react';
import { buildTrackId, type BilibiliVideo } from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUIShell } from '@/stores/ui-shell';
import { PartList } from '@/components/player/part-list';

/**
 * 批量分 P 选择对话框（VideoItem 三点菜单触发）。
 *
 * Dialog body 复用 PartList selectable + hidePinColumn + hideActiveHighlight：
 * 仅用于"选哪几 P 加入歌单"，不涉及播放上下文或默认 P 偏好。
 *
 * 提交时调 openAddToFavBatch(trackIds, { fromSearch })，trackIds 由
 * buildTrackId(bvid, page) 拼装（P1 自动转纯 bvid，与"整投稿"语义对齐）。
 */
export function PagesPickerDialog() {
  const open = useUIShell((s) => s.pagesPickerOpen);
  const close = useUIShell((s) => s.closePagesPicker);
  const video = useUIShell((s) => s.pagesPickerVideo);
  const openAddToFavBatch = useUIShell((s) => s.openAddToFavBatch);

  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    // 每次 dialog 打开/关闭重置选中
    if (!open) setSelected(new Set());
  }, [open]);

  const pages = useMemo(() => video?.pages ?? [], [video]);
  const totalP = pages.length || video?.videos || 0;
  const allChecked = selected.size > 0 && selected.size === pages.length;
  const indeterminate = selected.size > 0 && selected.size < pages.length;

  const toggle = (page: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pages.map((p) => p.page)));
    }
  };

  const handleSubmit = () => {
    if (!video || selected.size === 0) return;
    const trackIds = Array.from(selected)
      .sort((a, b) => a - b)
      .map((page) => buildTrackId(video.bvid, page));
    openAddToFavBatch(trackIds);
    close();
  };

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle>选择分 P 添加到歌单</DialogTitle>
          <DialogDescription className="line-clamp-2 break-words">{video.title}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={indeterminate ? 'indeterminate' : allChecked}
              onCheckedChange={handleToggleAll}
              aria-label={allChecked ? '取消全选' : '全选'}
            />
            <span>全选</span>
          </label>
          <span className="text-xs text-muted-foreground">
            共 {totalP} P · 已选 {selected.size}
          </span>
        </div>

        <div className="max-h-[50vh] overflow-hidden rounded-md border">
          <PartList
            pages={pages}
            activePage={0}
            onSelect={toggle}
            selectable
            selectedPages={selected}
            onToggleSelect={toggle}
            hidePinColumn
            hideActiveHighlight
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={selected.size === 0}>
            添加 ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
