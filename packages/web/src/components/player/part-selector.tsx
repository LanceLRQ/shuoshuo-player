import { useMemo } from 'react';
import {
  parseTrackId,
  usePlayingListStore,
  useVideoPagePrefStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { PartList } from './part-list';

interface PartSelectorProps {
  video: BilibiliVideo;
}

/**
 * SPlayer 控制条上的 P 选择器（Popover 内容）。
 *
 * 行为约束（§5.2）：
 * - 列出 video.pages 所有 P + 时长，当前实际播放 P 高亮
 * - 点击切 P → 调 switchToPage（不改 store.current）
 * - "设为默认 P" 复选框：
 *   - 显式 TrackId 上下文（current 含 :p<n>）置灰 — 显式条目已锚定 P，偏好不再适用
 *   - 状态 = (defaultPage[bvid] === playingPage 且 playingPage >= 2)
 *   - 勾选 → setDefaultPage(bvid, playingPage)
 *   - 取消 → setDefaultPage(bvid, 1)（store 内部会删 key）
 */
export function PartSelector({ video }: PartSelectorProps) {
  const pages = video.pages ?? [];
  const totalP = video.videos ?? pages.length;
  const currentTrackId = usePlayingListStore((s) => s.current);
  const playingPage = usePlayerRuntimeStore((s) => s.playingPage);
  const switchToPage = usePlayerRuntimeStore((s) => s.switchToPage);
  const defaultPage = useVideoPagePrefStore((s) => s.defaultPage[video.bvid] ?? 1);
  const setDefaultPage = useVideoPagePrefStore((s) => s.setDefaultPage);

  // 是否显式 TrackId（含 :p<n>）—— 决定"设为默认 P"是否可用
  const isExplicit = useMemo(() => {
    const parsed = parseTrackId(currentTrackId);
    return parsed?.page !== undefined;
  }, [currentTrackId]);

  // 默认 P 复选框选中态：当且仅当 playingPage >= 2 且与 defaultPage 一致
  const setAsDefaultChecked = playingPage >= 2 && defaultPage === playingPage;
  const setAsDefaultDisabled = isExplicit || playingPage < 2;

  const handleToggleDefault = (next: boolean) => {
    if (setAsDefaultDisabled) return;
    setDefaultPage(video.bvid, next ? playingPage : 1);
  };

  return (
    <div className="flex w-72 flex-col gap-1 p-1" aria-label="分 P 选择器">
      <div className="px-2 py-1 text-xs text-muted-foreground">
        当前：P{playingPage} / 共 {totalP} P
      </div>
      <PartList pages={pages} activePage={playingPage} onSelect={(page) => switchToPage?.(page)} />
      <div
        className={cn(
          'mt-1 flex items-center gap-2 border-t px-2 pt-2',
          setAsDefaultDisabled && 'opacity-50',
        )}
      >
        <Checkbox
          id="set-as-default-page"
          checked={setAsDefaultChecked}
          disabled={setAsDefaultDisabled}
          onCheckedChange={(v) => handleToggleDefault(v === true)}
          aria-label="将当前 P 设为该投稿的默认 P"
        />
        <Label
          htmlFor="set-as-default-page"
          className={cn('text-xs', setAsDefaultDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        >
          {isExplicit ? '该条目已显式锁定 P，不可改默认' : `将 P${playingPage} 设为该投稿的默认 P`}
        </Label>
      </div>
    </div>
  );
}
