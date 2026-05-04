import { useMemo, useState, type ReactNode } from 'react';
import { Lrc } from 'react-lrc';
import {
  ArrowLeft,
  Minimize2,
  Minus,
  Plus,
  RefreshCw,
  Pencil,
  ExternalLink,
  Maximize2,
} from 'lucide-react';
import {
  useLyricsStore,
  LyricApi,
  useUIStore,
  getPlatformBridge,
  NoticeType,
  usePlayingListStore,
  useBilibiliVideosStore,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { useUIShell } from '@/stores/ui-shell';

interface CloudLyricResponse {
  content?: string;
  id?: number;
  [k: string]: unknown;
}
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface LyricViewerProps {
  /** 触发歌词编辑器（由父组件接管） */
  onEdit?: () => void;
  /** 自定义歌词内容渲染（外部传入时替换默认 react-lrc 渲染） */
  children?: ReactNode;
}

/**
 * 歌词面板：作为 main 内的视图模式渲染（PlayerLayout 的 children），由 useUIShell.showLyric
 * 控制可见性。currentVideo / progress 不再由 SPlayer 通过 props 传入，自己从 useMusicPlayer
 * 取，避免跨组件 prop drilling 与重复订阅。
 *
 * 全屏模式：本地 state 切到 fixed inset-0 z-50 覆盖整屏（含 TopBar/footer）。
 */
export function LyricViewer({ onEdit, children }: LyricViewerProps) {
  // 不调用 useMusicPlayer：那是带 Howl 副作用的"主控"hook，重复调用会创建第二个独立实例
  // 让歌词 progress 永远停在 0。改为订阅 player-runtime store + playing-list / videos store 派生。
  const currentBvId = usePlayingListStore((s) => s.current);
  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const currentVideo = currentBvId ? (videoEntities[currentBvId] ?? null) : null;
  const currentTime = usePlayerRuntimeStore((s) => s.progress);
  const seek = usePlayerRuntimeStore((s) => s.seek);
  const closeLyric = useUIShell((s) => s.closeLyric);

  const lyricEntry = useLyricsStore((s) => (currentVideo ? s.lyricMaps[currentVideo.bvid] : null));
  const updateLyric = useLyricsStore((s) => s.updateLyric);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [customStep, setCustomStep] = useState(500);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const offsetMs = lyricEntry?.offset ?? 0;
  const offsetSec = offsetMs / 1000;

  const adjustOffset = (deltaMs: number) => {
    if (!currentVideo) return;
    updateLyric({
      bvid: currentVideo.bvid,
      lyricText: lyricEntry?.lyricText ?? '',
      offset: offsetMs + deltaMs,
    });
  };

  const handleRefreshFromCloud = () => {
    if (!currentVideo) return;
    LyricApi.getLyricByBvid(currentVideo.bvid)
      .then((resp) => {
        const lyric = resp as unknown as CloudLyricResponse;
        if (lyric?.content) {
          updateLyric({
            bvid: currentVideo.bvid,
            lyricText: lyric.content,
            offset: 0,
            cloudLyricId: lyric.id,
          });
          sendNotice({ type: NoticeType.SUCCESS, message: '歌词已刷新', duration: 2000 });
        } else if (__DEV_LOG__) {
          // 没有歌词不打扰用户，UI 显示"暂无歌词"已足够；调试时控制台留痕
          console.debug('[lyric] 云端无该视频歌词:', currentVideo.bvid);
        }
      })
      .catch((e: unknown) => {
        if (__DEV_LOG__) console.debug('[lyric] 手动刷新歌词失败:', e);
      });
  };

  const lyricText = lyricEntry?.lyricText ?? '';
  const currentMillisecond = useMemo(() => currentTime * 1000 - offsetMs, [currentTime, offsetMs]);

  return (
    <div
      className={cn(
        // 默认作为 main 内嵌容器：撑满父级 (h-full) + 列布局
        'flex h-full flex-col bg-background',
        // 全屏：脱离 main，覆盖整个 viewport（含 TopBar/footer）
        isFullscreen && 'fixed inset-0 z-50',
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={closeLyric} aria-label="关闭歌词">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate font-medium">{currentVideo?.title ?? '未播放'}</span>
        </div>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => adjustOffset(-customStep)}>
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>歌词提前 {customStep}ms</TooltipContent>
            </Tooltip>
            <Input
              type="number"
              value={customStep}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCustomStep(Number.isFinite(v) ? Math.max(1, Math.min(99999, v)) : 500);
              }}
              className="h-8 w-20 text-center"
              min={1}
              max={99999}
              aria-label="偏移步长 ms"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => adjustOffset(customStep)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>歌词延后 {customStep}ms</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleRefreshFromCloud}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>从云端刷新歌词</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onEdit?.()}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑歌词</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!currentVideo) return;
                    void getPlatformBridge().shell.openExternal(
                      `https://www.bilibili.com/video/${currentVideo.bvid}`,
                    );
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>去 B 站看</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsFullscreen((s) => !s)}>
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? '退出全屏' : '进入全屏'}</TooltipContent>
            </Tooltip>
            {offsetSec !== 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                偏移 {offsetSec.toFixed(2)}s
              </span>
            )}
          </div>
        </TooltipProvider>
      </div>

      {children ? (
        <div className="flex-1 overflow-hidden">{children}</div>
      ) : (
        // 滚动容器撑满 main 全宽 → 滚动条贴 main 右边缘；Lrc 内 px-8 给文字留侧边距，
        // text-center 让歌词水平居中显示（视觉效果与原 max-w-2xl + flex justify-center 一致，
        // 区别是滚动条不再被夹在中间的 672px 容器右缘）
        <div className="flex-1 overflow-hidden">
          {lyricText ? (
            <Lrc
              lrc={lyricText}
              currentMillisecond={currentMillisecond}
              className="h-full w-full px-8 text-center"
              lineRenderer={({ active, line }) => (
                <p
                  onDoubleClick={() => {
                    // 反向应用 offsetMs：line.startMillisecond + offsetMs 是音频真实毫秒
                    // 正向：currentMillisecond = currentTime * 1000 - offsetMs
                    if (seek) seek((line.startMillisecond + offsetMs) / 1000);
                  }}
                  className={cn(
                    'cursor-pointer select-none py-2 transition-all duration-200 ease-out',
                    active
                      ? 'scale-105 text-2xl font-bold text-primary'
                      : 'text-base text-muted-foreground/60 hover:text-muted-foreground',
                  )}
                >
                  {line.content || ' '}
                </p>
              )}
              verticalSpace
            />
          ) : (
            <p className="flex h-full items-center justify-center text-muted-foreground">
              暂无歌词
            </p>
          )}
        </div>
      )}
    </div>
  );
}
