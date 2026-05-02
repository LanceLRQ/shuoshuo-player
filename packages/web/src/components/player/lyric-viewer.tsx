import { useMemo, useState, type ReactNode } from 'react';
import { Lrc } from 'react-lrc';
import { Minimize2, Minus, Plus, RefreshCw, Pencil, ExternalLink, Maximize2 } from 'lucide-react';
import {
  useLyricsStore,
  LyricApi,
  useUIStore,
  NoticeType,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CloudLyricResponse {
  content?: string;
  id?: number;
  [k: string]: unknown;
}
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface LyricViewerProps {
  open: boolean;
  onClose: () => void;
  currentVideo: BilibiliVideo | null;
  /** 当前播放进度（秒） */
  currentTime: number;
  /** 触发歌词编辑器（由父组件接管） */
  onEdit?: () => void;
  children?: ReactNode;
}

export function LyricViewer({
  open,
  onClose,
  currentVideo,
  currentTime,
  onEdit,
  children,
}: LyricViewerProps) {
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
        const lyric = resp as CloudLyricResponse;
        if (lyric?.content) {
          updateLyric({
            bvid: currentVideo.bvid,
            lyricText: lyric.content,
            offset: 0,
            cloudLyricId: lyric.id,
          });
          sendNotice({ type: NoticeType.SUCCESS, message: '歌词已刷新', duration: 2000 });
        } else {
          sendNotice({ type: NoticeType.WARN, message: '云端无歌词', duration: 2000 });
        }
      })
      .catch(() => {
        sendNotice({ type: NoticeType.ERROR, message: '歌词获取失败', duration: 3000 });
      });
  };

  const lyricText = lyricEntry?.lyricText ?? '';
  const currentMillisecond = useMemo(() => currentTime * 1000 - offsetMs, [currentTime, offsetMs]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-20 top-14 z-40 flex flex-col bg-background/95 backdrop-blur',
        isFullscreen && 'inset-0',
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭歌词">
            <Minimize2 className="h-5 w-5" />
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
                  onClick={() =>
                    currentVideo &&
                    window.open(
                      `https://www.bilibili.com/video/${currentVideo.bvid}`,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>去 B 站看</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen((s) => !s)}
                >
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
        <div className="flex flex-1 items-center justify-center overflow-hidden p-8">
          {lyricText ? (
            <Lrc
              lrc={lyricText}
              currentMillisecond={currentMillisecond}
              className="h-full w-full max-w-2xl text-center"
              lineRenderer={({ active, line }) => (
                <p
                  className={cn(
                    'py-2 text-base transition-colors',
                    active ? 'text-primary text-xl font-semibold' : 'text-muted-foreground',
                  )}
                >
                  {line.content || ' '}
                </p>
              )}
              verticalSpace
            />
          ) : (
            <p className="text-muted-foreground">暂无歌词</p>
          )}
        </div>
      )}
    </div>
  );
}
