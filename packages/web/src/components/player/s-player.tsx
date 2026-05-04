import { useState } from 'react';
import {
  Play,
  Pause,
  Loader2,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  Music,
  ListMusic,
  Plus,
  ExternalLink,
} from 'lucide-react';
import {
  usePlayerProfileStore,
  urlPrefixFixed,
  formatPlayTime,
  getPlatformBridge,
  type LoopMode,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Marquee } from '@/components/marquee';
import { useMusicPlayer } from '@/hooks/use-music-player';
import { useUIShell } from '@/stores/ui-shell';
import { PlayingQueue } from './playing-queue';

const LOOP_MODE_TIPS: Record<LoopMode, string> = {
  single: '单曲循环',
  loop: '列表循环',
  random: '随机播放',
};

interface SPlayerProps {
  /** 触发"添加到歌单"时由调用方接管（默认 fallback：openAddToFav） */
  onAddToFav?: (bvid: string) => void;
}

export function SPlayer({ onAddToFav }: SPlayerProps = {}) {
  const player = useMusicPlayer();
  const volume = usePlayerProfileStore((s) => s.volume);
  const loopMode = usePlayerProfileStore((s) => s.loopMode);
  const openAddToFav = useUIShell((s) => s.openAddToFav);
  const showLyric = useUIShell((s) => s.showLyric);
  const toggleLyric = useUIShell((s) => s.toggleLyric);

  const [showQueue, setShowQueue] = useState(false);

  const cur = player.currentVideo;
  const cover = cur?.pic ? urlPrefixFixed(cur.pic) : '';
  const LoopIcon = loopMode === 'single' ? Repeat1 : loopMode === 'random' ? Shuffle : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  const handleSeek = (vals: number[]) => {
    if (vals[0] !== undefined) player.seek(vals[0]);
  };

  const handleVolumeChange = (vals: number[]) => {
    if (vals[0] !== undefined) player.setVolume(vals[0] / 100);
  };

  const handleAddToFav = () => {
    if (!cur) return;
    if (onAddToFav) onAddToFav(cur.bvid);
    else openAddToFav(cur.bvid);
  };

  return (
    <>
      {/*
       * footer 作为 PlayerLayout grid row 3，自身 relative 给 progress slider absolute 锚点。
       * grid 子级 DOM 顺序：row1 (TopBar) > row2 (NavMenu+main) > row3 (footer)，
       * 同 z auto 时 footer 整体（含 thumb 溢出 6px）渲染在 row2 之上，无需 z-index。
       */}
      <footer className="relative h-20 border-t bg-background">
        <div className="absolute -top-[6px] left-0 right-0 px-2">
          <Slider
            value={[player.progress]}
            max={Math.max(player.duration, 0.01)}
            step={0.1}
            onValueChange={handleSeek}
            aria-label="播放进度"
            className="cursor-pointer"
          />
        </div>

        <div className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4">
          {/* 左：封面 + 信息 */}
          <div className="flex min-w-0 items-center gap-3">
            {cover ? (
              <img
                src={cover}
                alt=""
                className="h-12 w-12 cursor-pointer rounded object-cover"
                onClick={() => cur && !showLyric && toggleLyric()}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                <Music className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Marquee text={cur?.title ?? '未播放'} className="text-sm font-medium" />
              <p className="truncate text-xs text-muted-foreground">{cur?.author ?? ''}</p>
            </div>
            {cur && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() =>
                  void getPlatformBridge().shell.openExternal(
                    `https://www.bilibili.com/video/${cur.bvid}`,
                  )
                }
                aria-label="去 B 站"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* 中：控制 */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={player.cycleLoopMode}>
                    <LoopIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{LOOP_MODE_TIPS[loopMode]}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={player.prev}>
                    <SkipBack className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>上一首</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={player.togglePlay}
                    disabled={!cur || player.isLoading}
                  >
                    {player.isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : player.isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{player.isPlaying ? '暂停' : '播放'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={player.next}>
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>下一首</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* 右：时间 + 音量 + 队列 + 歌词 + 收藏 */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
              <span className="hidden tabular-nums md:inline">
                {formatPlayTime(player.progress)} / {formatPlayTime(player.duration)}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <VolumeIcon className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  sideOffset={10}
                  className="flex h-32 w-10 items-center justify-center p-2"
                >
                  <Slider
                    orientation="vertical"
                    value={[Math.round(volume * 100)]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    aria-label="音量"
                  />
                </PopoverContent>
              </Popover>
              {cur && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleAddToFav}>
                        <Plus className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>添加到歌单</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleLyric}
                        className={cn(showLyric && 'text-primary')}
                      >
                        <Music className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{showLyric ? '关闭歌词' : '显示歌词'}</TooltipContent>
                  </Tooltip>
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowQueue((s) => !s)}>
                    <ListMusic className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>播放队列</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* 当前歌词条（无视图时显示在播放器内） */}
        {!showLyric && player.currentLyricLine && (
          <p className="pointer-events-none absolute inset-x-0 -top-7 mx-auto w-fit max-w-[60%] truncate rounded bg-background/80 px-3 py-1 text-center text-xs text-primary">
            {player.currentLyricLine}
          </p>
        )}
      </footer>

      <PlayingQueue open={showQueue} onOpenChange={setShowQueue} />
    </>
  );
}
