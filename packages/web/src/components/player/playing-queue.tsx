import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  useBilibiliVideosStore,
  usePlayingListStore,
  urlPrefixFixed,
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

interface PlayingQueueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NARROW_QUERY = '(max-width: 1024px)';

/**
 * 播放队列：宽屏右侧 Sheet，窄屏底部 Sheet（避免 Popover virtualRef 兼容问题）。
 */
export function PlayingQueue({ open, onOpenChange }: PlayingQueueProps) {
  const bvIds = usePlayingListStore((s) => s.bvIds);
  const currentBvId = usePlayingListStore((s) => s.current);
  const updateCurrentPlaying = usePlayingListStore((s) => s.updateCurrentPlaying);
  const removeItem = usePlayingListStore((s) => s.removeItem);
  const clearPlaylist = usePlayingListStore((s) => s.clearPlaylist);
  const videoEntities = useBilibiliVideosStore((s) => s.entities);

  const [isNarrow, setIsNarrow] = useState(false);
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
    if (!open || !currentBvId) return;
    const timer = setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-bv="${currentBvId}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [open, currentBvId]);

  const handlePlayAt = (bvid: string) => {
    const idx = bvIds.indexOf(bvid);
    if (idx >= 0) updateCurrentPlaying(idx, true);
  };

  const list = useMemo(
    () => bvIds.map((id) => ({ bvid: id, video: videoEntities[id] })),
    [bvIds, videoEntities],
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
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-base font-semibold">播放队列</h3>
              <p className="text-xs text-muted-foreground">共 {bvIds.length} 首</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPlaylist}
              disabled={bvIds.length === 0}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              清空
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div ref={listRef} className="flex flex-col p-2">
              {list.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">队列为空</p>
              )}
              {list.map(({ bvid, video }) => {
                const isCurrent = bvid === currentBvId;
                return (
                  <div
                    key={bvid}
                    data-bv={bvid}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent',
                      isCurrent && 'bg-accent',
                    )}
                    onClick={() => handlePlayAt(bvid)}
                  >
                    {video?.pic ? (
                      <img
                        src={urlPrefixFixed(video.pic)}
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
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {video?.author ?? ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(bvid);
                      }}
                      aria-label="移除"
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
