import { useEffect, useRef, useState } from 'react';
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
  AudioLines,
  Crown,
  Check,
} from 'lucide-react';
import {
  usePlayerProfileStore,
  usePlayingListStore,
  useTrackQualityPrefStore,
  useBilibiliUserStore,
  useUIStore,
  invalidateMusicUrlCache,
  isExplicitPageTrackId,
  urlPrefixFixed,
  formatPlayTime,
  formatTimeLyric,
  getPlatformBridge,
  NoticeType,
  type LoopMode,
  type AudioQualityPreference,
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
import sliderThumbImg from '@/assets/slider-thumb.webp';

const LOOP_MODE_TIPS: Record<LoopMode, string> = {
  single: '单曲循环',
  loop: '列表循环',
  random: '随机播放',
};

/** 单曲音质菜单项；'follow' 表示清除覆盖、继承设置页的默认音质 */
const TRACK_QUALITY_ITEMS: Array<{
  value: AudioQualityPreference | 'follow';
  label: string;
  vipOnly?: boolean;
}> = [
  { value: 'follow', label: '继承设置页设置' },
  { value: 'hires', label: 'Hi-Res 无损', vipOnly: true },
  { value: 'dolby', label: '杜比全景声', vipOnly: true },
  { value: 'high', label: '高品质 192K' },
  { value: 'medium', label: '标准 132K' },
  { value: 'low', label: '流畅 64K' },
];

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
  const lyricEditing = useUIShell((s) => s.lyricEditing);
  const floatingLyricsEnabled = usePlayerProfileStore((s) => s.floatingLyrics.enabled);
  const toggleFloatingLyrics = usePlayerProfileStore((s) => s.toggleFloatingLyrics);
  const trackQualityMap = useTrackQualityPrefStore((s) => s.quality);
  const setTrackQuality = useTrackQualityPrefStore((s) => s.setQuality);
  const clearTrackQuality = useTrackQualityPrefStore((s) => s.clearQuality);
  const isVip = useBilibiliUserStore((s) => Boolean(s.current?.vipType));
  const sendNotice = useUIStore((s) => s.sendNotice);

  // 显式 :p<n> 条目播放上下文：已锁定 P，不再展示分 P 选择器
  const isExplicitContext = isExplicitPageTrackId(currentTrackId);

  // 进度条 thumb 显隐：JS 控制（mouseenter 立显、mouseleave 延迟 0.5s 隐藏）
  // 比纯 CSS group-hover 更友好：避免快速划过时 thumb 一闪而过的视觉抖动
  const [showProgressThumb, setShowProgressThumb] = useState(false);
  const hideThumbTimerRef = useRef<number | null>(null);

  const handleProgressMouseEnter = () => {
    if (hideThumbTimerRef.current !== null) {
      window.clearTimeout(hideThumbTimerRef.current);
      hideThumbTimerRef.current = null;
    }
    setShowProgressThumb(true);
  };

  const handleProgressMouseLeave = () => {
    if (hideThumbTimerRef.current !== null) window.clearTimeout(hideThumbTimerRef.current);
    hideThumbTimerRef.current = window.setTimeout(() => {
      setShowProgressThumb(false);
      hideThumbTimerRef.current = null;
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (hideThumbTimerRef.current !== null) window.clearTimeout(hideThumbTimerRef.current);
    };
  }, []);

  const [showQueue, setShowQueue] = useState(false);
  const [showPartSelector, setShowPartSelector] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  // 拖动进度条时只更新本地显示值（不实时 seek 音频，避免快速拖动频繁 seek 导致鬼畜）；
  // 释放（onValueCommit）才真正 seek。null 表示未在拖动，thumb 跟随实时播放进度。
  const [seekingValue, setSeekingValue] = useState<number | null>(null);

  const cur = player.currentVideo;
  const currentTrackQuality = cur ? trackQualityMap[cur.bvid] : undefined;
  const cover = cur?.pic ? urlPrefixFixed(cur.pic) : '';
  const LoopIcon = loopMode === 'single' ? Repeat1 : loopMode === 'random' ? Shuffle : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  // 拖动中：仅更新本地显示值，让 thumb 跟手，不触碰音频
  const handleSeekChange = (vals: number[]) => {
    if (vals[0] !== undefined) setSeekingValue(vals[0]);
  };

  // 释放（或键盘单步结束）：一次性 seek 到目标位置并退出拖动态
  const handleSeekCommit = (vals: number[]) => {
    if (vals[0] !== undefined) player.seek(vals[0]);
    setSeekingValue(null);
  };

  const handleVolumeChange = (vals: number[]) => {
    if (vals[0] !== undefined) player.setVolume(vals[0] / 100);
  };

  const handleAddToFav = () => {
    if (!cur) return;
    if (onAddToFav) onAddToFav(cur.bvid);
    else openAddToFav(cur.bvid);
  };

  const handlePickQuality = (value: AudioQualityPreference | 'follow') => {
    if (!cur) return;
    if (value === 'follow') clearTrackQuality(cur.bvid);
    else setTrackQuality(cur.bvid, value);
    // 仅失效这首的 URL 缓存，下次播放 / 切歌按新音质取流（不打断当前播放）
    invalidateMusicUrlCache(cur.bvid);
    setShowQuality(false);
    sendNotice({
      type: NoticeType.INFO,
      message: '音质已更新，重新播放或切歌后生效',
      duration: 3000,
    });
  };

  return (
    <>
      {/*
       * footer 作为 PlayerLayout grid row 3，自身 relative 给 progress slider absolute 锚点。
       * grid 子级 DOM 顺序：row1 (TopBar) > row2 (NavMenu+main) > row3 (footer)，
       * 同 z auto 时 footer 整体（含 thumb 溢出 6px）渲染在 row2 之上，无需 z-index。
       */}
      <footer className="relative h-20 border-t bg-background dark:bg-muted">
        {/* 进度条 hot zone：用 -top-[12px] + py-1.5 把视觉位置不变的同时，
            mouse hit area 从 ~14px 撑到 ~26px，便于鼠标精准 hover；
            mouseenter/leave 配合 1.5s 延时隐藏（避免快速划过时 thumb 闪一下就消失） */}
        <div
          className="absolute -top-[12px] left-0 right-0 py-1.5"
          onMouseEnter={handleProgressMouseEnter}
          onMouseLeave={handleProgressMouseLeave}
        >
          {/* 歌词编辑模式：时间气泡，跟随滑块显示 */}
          {lyricEditing && player.duration > 0 && (
            <div
              className="absolute -top-6 -translate-x-1/2 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
              style={{ left: `${(player.progress / player.duration) * 100}%` }}
            >
              {formatTimeLyric(player.progress * 1000)}
            </div>
          )}
          <Slider
            value={[seekingValue ?? player.progress]}
            max={Math.max(player.duration, 0.01)}
            step={0.1}
            onValueChange={handleSeekChange}
            onValueCommit={handleSeekCommit}
            aria-label="播放进度"
            thumbSrc={sliderThumbImg}
            className={cn(
              // focus-visible 仅匹配「键盘」focus（鼠标点击不触发），避免点击拖拽后 thumb
              // 因获得 focus 而持久显示；鼠标用户由 showProgressThumb 状态完全控制
              'cursor-pointer [&_[role=slider]]:transition-opacity [&_[role=slider]:focus-visible]:opacity-100',
              showProgressThumb ? '[&_[role=slider]]:opacity-100' : '[&_[role=slider]]:opacity-0',
            )}
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
              {cur && (
                <Popover open={showQuality} onOpenChange={setShowQuality}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={CTRL_BTN_TEXT}
                          aria-label="音质"
                        >
                          <AudioLines className="h-5 w-5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>音质（仅当前歌曲）</TooltipContent>
                  </Tooltip>
                  <PopoverContent side="top" align="end" sideOffset={10} className="w-44 p-1">
                    {TRACK_QUALITY_ITEMS.map((item) => {
                      const disabled = Boolean(item.vipOnly) && !isVip;
                      const active =
                        item.value === 'follow'
                          ? currentTrackQuality === undefined
                          : currentTrackQuality === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => handlePickQuality(item.value)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm',
                            disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-accent',
                            active && 'font-medium text-primary',
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            {item.label}
                            {item.vipOnly && <Crown className="h-3 w-3 text-amber-500" />}
                          </span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              )}
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
