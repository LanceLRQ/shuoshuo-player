import { useMemo, useState } from 'react';
import { ListChecks, Plus, X } from 'lucide-react';
import {
  buildTrackId,
  isExplicitPageTrackId,
  usePlayingListStore,
  useVideoPagePrefStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { useUIShell } from '@/stores/ui-shell';
import { PartList } from './part-list';

interface PartSelectorProps {
  video: BilibiliVideo;
  /** 加入歌单提交后 / 退多选关 popover 的回调（由父组件控制 Popover open 状态） */
  onAfterSubmit?: () => void;
}

/**
 * SPlayer 控制条 P 选择 Popover 内容。
 *
 * 常态：单击行切 P 播放；Pin 列点击切换默认 P 偏好。
 * 多选模式：行点击改为切勾选；底部"加入歌单(N)"批量加入。
 *
 * 与 useVideoPagePrefStore / usePlayerRuntimeStore.switchToPage / useUIShell.openAddToFavBatch
 * 解耦：所有状态都通过既有 store API 操作。
 */
export function PartSelector({ video, onAfterSubmit }: PartSelectorProps) {
  const pages = video.pages ?? [];
  const totalP = video.videos ?? pages.length;
  const currentTrackId = usePlayingListStore((s) => s.current);
  const playingPage = usePlayerRuntimeStore((s) => s.playingPage);
  const switchToPage = usePlayerRuntimeStore((s) => s.switchToPage);
  const defaultPage = useVideoPagePrefStore((s) => s.defaultPage[video.bvid] ?? 1);
  const setDefaultPage = useVideoPagePrefStore((s) => s.setDefaultPage);
  const openAddToFavBatch = useUIShell((s) => s.openAddToFavBatch);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const isExplicit = useMemo(() => isExplicitPageTrackId(currentTrackId), [currentTrackId]);

  const toggleSelect = (page: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  };

  const handleEnterSelect = () => {
    setSelectMode(true);
    setSelected(new Set());
  };

  const handleExitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleToggleAll = () => {
    if (selected.size === pages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pages.map((p) => p.page)));
    }
  };

  const handleTogglePin = (page: number) => {
    if (defaultPage === page) {
      setDefaultPage(video.bvid, 1);
    } else {
      setDefaultPage(video.bvid, page);
    }
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    const trackIds = Array.from(selected)
      .sort((a, b) => a - b)
      .map((page) => buildTrackId(video.bvid, page));
    openAddToFavBatch(trackIds);
    handleExitSelect();
    onAfterSubmit?.();
  };

  return (
    <div className="flex w-72 flex-col gap-0 p-1" aria-label="分 P 选择器">
      {/* Header */}
      {selectMode ? (
        <div className="flex items-center gap-1 border-b px-1 py-1">
          <span className="shrink-0 text-xs text-muted-foreground">已选 {selected.size}</span>
          <button
            type="button"
            onClick={handleToggleAll}
            className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-accent"
          >
            {selected.size === pages.length ? '反选' : '全选'}
          </button>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={selected.size === 0}
            className="h-6 gap-1 px-2 text-xs"
          >
            <Plus className="h-3 w-3" />
            加入歌单 ({selected.size})
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleExitSelect}
            className="h-6 w-6"
            aria-label="退出多选"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
          <span className="text-xs text-muted-foreground">
            当前 P{playingPage} · 共 {totalP} P
            {defaultPage >= 2 && <span className="ml-1 text-primary">· 默认 P{defaultPage}</span>}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleEnterSelect}
            className="h-6 w-6"
            aria-label="进入多选模式"
          >
            <ListChecks className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* P 列表（依赖 PartList 多选 + Pin 支持） */}
      <PartList
        pages={pages}
        activePage={playingPage}
        onSelect={(page) => switchToPage?.(page)}
        selectable={selectMode}
        selectedPages={selected}
        onToggleSelect={toggleSelect}
        defaultPage={defaultPage}
        onTogglePin={handleTogglePin}
        pinDisabled={isExplicit}
        pinDisabledReason="当前条目已显式锁定 P，默认 P 不适用"
        className={cn('mt-1', selectMode && 'mt-0')}
      />
    </div>
  );
}
