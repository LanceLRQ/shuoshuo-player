import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Trash2, X } from 'lucide-react';
import {
  useBilibiliVideosStore,
  usePlayingListStore,
  bilibiliThumbUrl,
  parseTrackId,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { PartList } from './part-list';

interface PlayingQueueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NARROW_QUERY = '(max-width: 1024px)';

interface QueueRow {
  trackId: string;
  bvid: string;
  explicitPage?: number;
  video?: BilibiliVideo;
}

/**
 * 播放队列：宽屏右侧 Sheet，窄屏底部 Sheet（避免 Popover virtualRef 兼容问题）。
 *
 * 自 C3 起支持多 P 投稿的折叠展开：
 * - 纯 bvid 多 P 投稿在尾部加 ▾ 折叠按钮，展开后列出所有 P
 * - 显式 :p<n> 条目不展开（已是单 P）
 * - 点击展开行的 P → 调 usePlayerRuntimeStore.switchToPage(n)，不动 queue.trackIds
 */
export function PlayingQueue({ open, onOpenChange }: PlayingQueueProps) {
  const trackIds = usePlayingListStore((s) => s.trackIds);
  const currentTrackId = usePlayingListStore((s) => s.current);
  const updateCurrentPlaying = usePlayingListStore((s) => s.updateCurrentPlaying);
  const removeItem = usePlayingListStore((s) => s.removeItem);
  const clearPlaylist = usePlayingListStore((s) => s.clearPlaylist);
  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const playingPage = usePlayerRuntimeStore((s) => s.playingPage);
  const switchToPage = usePlayerRuntimeStore((s) => s.switchToPage);

  const [isNarrow, setIsNarrow] = useState(false);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia(NARROW_QUERY);
    setIsNarrow(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // 打开后延迟 100ms 滚动到当前曲目
  useEffect(() => {
    if (!open || !currentTrackId) return;
    const timer = setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-bv="${currentTrackId}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [open, currentTrackId]);

  const handlePlayAt = (trackId: string) => {
    const idx = trackIds.indexOf(trackId);
    if (idx >= 0) updateCurrentPlaying(idx, true);
  };

  const toggleExpand = (trackId: string) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const list = useMemo<QueueRow[]>(
    () =>
      trackIds.map((id) => {
        const parsed = parseTrackId(id);
        const bvid = parsed?.bvid ?? id;
        return {
          trackId: id,
          bvid,
          explicitPage: parsed?.page,
          video: videoEntities[bvid],
        };
      }),
    [trackIds, videoEntities],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isNarrow ? 'bottom' : 'right'}
        className={cn('p-0', isNarrow ? 'h-[60vh]' : 'w-[400px] sm:max-w-md')}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>播放队列</SheetTitle>
          <SheetDescription>当前播放队列</SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col">
          {/* pr-12 给 SheetContent 右上角内置关闭按钮（absolute right-4 top-4）预留空间 */}
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3 pr-12">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold">播放队列</h3>
              <p className="truncate text-xs text-muted-foreground">共 {trackIds.length} 首</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearPlaylist}
              disabled={trackIds.length === 0}
              className="h-7 shrink-0 gap-1 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-offset-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </Button>
          </div>
          {/* Radix ScrollArea.Viewport 内部用 display:table; min-width:100% 包裹 children
              会让内容按最长元素撑开宽度（用于支持横向滚动），导致子项 truncate 失效。
              这里把 viewport 内的 table-div 强制改回 block，让宽度从父级 flex 流下来 */}
          <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
            <div ref={listRef} className="flex flex-col p-2">
              {list.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">队列为空</p>
              )}
              {list.map(({ trackId, bvid, explicitPage, video }) => {
                const isCurrent = trackId === currentTrackId;
                const totalP = video?.videos ?? 1;
                // 仅纯 bvid + 多 P 投稿才支持折叠展开（显式 :p<n> 已锚定单 P）
                const isExpandable = totalP > 1 && explicitPage === undefined;
                const isExpanded = isExpandable && expandedTracks.has(trackId);
                return (
                  <div key={trackId}>
                    <div
                      data-bv={trackId}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent',
                        isCurrent && 'bg-accent',
                      )}
                      onClick={() => handlePlayAt(trackId)}
                    >
                      {video?.pic ? (
                        <img
                          src={bilibiliThumbUrl(video.pic, 160, 100)}
                          alt=""
                          loading="lazy"
                          className="h-10 w-16 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-16 shrink-0 rounded bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm',
                            isCurrent && 'font-semibold text-primary',
                          )}
                        >
                          {video?.title ?? bvid}
                          {explicitPage !== undefined && (
                            <span className="ml-1 rounded border border-primary/60 px-1 py-0 text-[10px] leading-tight text-primary">
                              P{explicitPage}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {video?.author ?? ''}
                          {totalP > 1 && explicitPage === undefined && (
                            <span className="ml-1 text-[10px]">· {totalP}P</span>
                          )}
                        </p>
                      </div>
                      {isExpandable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(trackId);
                          }}
                          aria-label={isExpanded ? '收起分 P' : '展开分 P'}
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform',
                              isExpanded && 'rotate-180',
                            )}
                          />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(trackId);
                        }}
                        aria-label="移除"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {isExpanded && video?.pages && (
                      <PartList
                        pages={video.pages}
                        activePage={isCurrent ? playingPage : 0}
                        variant="inline"
                        onSelect={(page) => {
                          if (!isCurrent) handlePlayAt(trackId);
                          switchToPage?.(page);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
