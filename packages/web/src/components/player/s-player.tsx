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
  Captions,
  ListMusic,
  Plus,
  ExternalLink,
  Expand,
  Layers,
} from 'lucide-react';
import {
  usePlayerProfileStore,
  usePlayingListStore,
  isExplicitPageTrackId,
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
import { PartSelector } from './part-selector';
import { FloatingLyrics } from './floating-lyrics';

const LOOP_MODE_TIPS: Record<LoopMode, string> = {
  single: '单曲循环',
  loop: '列表循环',
  random: '随机播放',
};

// 播放控制栏 ghost 按钮文字色：亮色模式用主色调，暗色模式保持默认前景。
const CTRL_BTN_TEXT = 'text-primary dark:text-foreground';

interface SPlayerProps {
  /** 触发"添加到歌单"时由调用方接管（默认 fallback：openAddToFav） */
  onAddToFav?: (bvid: string) => void;
}

export function SPlayer({ onAddToFav }: SPlayerProps = {}) {
  const player = useMusicPlayer();
  const volume = usePlayerProfileStore((s) => s.volume);
  const loopMode = usePlayerProfileStore((s) => s.loopMode);
  const currentTrackId = usePlayingListStore((s) => s.current);
  const openAddToFav = useUIShell((s) => s.openAddToFav);
  const showLyric = useUIShell((s) => s.showLyric);
  const toggleLyric = useUIShell((s) => s.toggleLyric);
  const floatingLyricsEnabled = usePlayerProfileStore((s) => s.floatingLyrics.enabled);
  const toggleFloatingLyrics = usePlayerProfileStore((s) => s.toggleFloatingLyrics);

  // 显式 :p<n> 条目播放上下文：已锁定 P，不再展示分 P 选择器
  const isExplicitContext = isExplicitPageTrackId(currentTrackId);

  const [showQueue, setShowQueue] = useState(false);
  const [showPartSelector, setShowPartSelector] = useState(false);

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
      <footer className="relative h-20 border-t bg-background dark:bg-muted">
        <div className="absolute -top-[6px] left-0 right-0">
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
              <div
                className="group relative h-12 w-12 shrink-0"
                onClick={() => cur && !showLyric && toggleLyric()}
                role={cur && !showLyric ? 'button' : undefined}
                aria-label={cur && !showLyric ? '展开全屏歌词' : undefined}
              >
                <img
                  src={cover}
                  alt=""
                  className={cn(
                    'block h-12 w-12 rounded object-cover',
                    cur && !showLyric && 'cursor-pointer',
                  )}
                />
                {cur && !showLyric && (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  >
                    <Expand className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
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
                className={cn('h-8 w-8 shrink-0', CTRL_BTN_TEXT)}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className={CTRL_BTN_TEXT}
                    onClick={player.cycleLoopMode}
                  >
                    <LoopIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{LOOP_MODE_TIPS[loopMode]}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={CTRL_BTN_TEXT}
                    onClick={player.prev}
                  >
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className={CTRL_BTN_TEXT}
                    onClick={player.next}
                  >
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
                  <Button variant="ghost" size="icon" className={CTRL_BTN_TEXT}>
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
              {cur && (cur.videos ?? 1) > 1 && !isExplicitContext && (
                <Popover open={showPartSelector} onOpenChange={setShowPartSelector}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={CTRL_BTN_TEXT}
                          aria-label="选择分 P"
                        >
                          <Layers className="h-5 w-5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>选择分 P</TooltipContent>
                  </Tooltip>
                  <PopoverContent side="top" align="end" sideOffset={10} className="w-auto p-0">
                    <PartSelector video={cur} onAfterSubmit={() => setShowPartSelector(false)} />
                  </PopoverContent>
                </Popover>
              )}
              {cur && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={CTRL_BTN_TEXT}
                        onClick={handleAddToFav}
                      >
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
                        onClick={toggleFloatingLyrics}
                        className={cn(CTRL_BTN_TEXT, floatingLyricsEnabled && 'bg-accent')}
                        aria-label="悬浮歌词"
                      >
                        <Captions className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {floatingLyricsEnabled ? '关闭悬浮歌词' : '显示悬浮歌词'}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={CTRL_BTN_TEXT}
                    onClick={() => setShowQueue((s) => !s)}
                  >
                    <ListMusic className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>播放队列</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* 悬浮歌词：受 floatingLyrics.enabled + 全屏歌词页状态 + 当前歌词条件门控 */}
        <FloatingLyrics
          line={player.currentLyricLine ?? ''}
          visible={!showLyric && floatingLyricsEnabled && !!cur && !!player.currentLyricLine}
        />
      </footer>

      <PlayingQueue open={showQueue} onOpenChange={setShowQueue} />
    </>
  );
}
