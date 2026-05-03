import { type CSSProperties, memo, useCallback, useState } from 'react';
import dayjs from 'dayjs';
import {
  Play,
  PlayCircle,
  Clock,
  MessageSquare,
  Plus,
  MoreVertical,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  usePlayingListStore,
  useUIStore,
  formatNumber10K,
  bilibiliThumbUrl,
  NoticeType,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export interface VideoItemProps {
  video: BilibiliVideo;
  /** 所在歌单 ID，决定播放时是否加载整张歌单 */
  favId?: string;
  showAuthor?: boolean;
  fullCreateTime?: boolean;
  /** 搜索结果 <em> 高亮通过 dangerouslySetInnerHTML 渲染 */
  htmlTitle?: boolean;
  /** 来自搜索结果时主按钮变为"添加到歌单" */
  fromSearch?: boolean;
  /** 显示"添加到歌单"按钮（默认 true） */
  showAddBtn?: boolean;
  /** 显示"加入队列尾部"按钮（默认 true） */
  showAddToPlayBtn?: boolean;
  showRemoveBtn?: boolean;
  onRemove?: (bvid: string) => void;
  onAddToFav?: (video: BilibiliVideo, fromSearch?: boolean) => void;
  style?: CSSProperties;
  className?: string;
}

function VideoItemImpl({
  video,
  favId,
  showAuthor = false,
  fullCreateTime = false,
  htmlTitle = false,
  fromSearch = false,
  showAddBtn = true,
  showAddToPlayBtn = true,
  showRemoveBtn = false,
  onRemove,
  onAddToFav,
  style,
  className,
}: VideoItemProps) {
  const currentBvId = usePlayingListStore((s) => s.current);
  const setPlaylist = usePlayingListStore((s) => s.setPlaylist);
  const addSingle = usePlayingListStore((s) => s.addSingle);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [imgError, setImgError] = useState(false);

  const isPlaying = currentBvId === video.bvid;

  const handlePlayClick = useCallback(() => {
    if (favId) {
      // 由调用方决定是否要预先 setPlaylist；这里仅插入并标记 playNow
      addSingle(video.bvid, true);
    } else {
      setPlaylist('', [video.bvid], video.bvid, true);
    }
  }, [addSingle, setPlaylist, favId, video.bvid]);

  const handleAddToPlay = useCallback(() => {
    addSingle(video.bvid, false);
    sendNotice({ type: NoticeType.SUCCESS, message: '添加成功', duration: 2000 });
  }, [addSingle, sendNotice, video.bvid]);

  const handleAddToFav = useCallback(() => {
    onAddToFav?.(video, fromSearch);
  }, [onAddToFav, video, fromSearch]);

  const handleOpenBilibili = useCallback(() => {
    window.open(`https://www.bilibili.com/video/${video.bvid}`, '_blank', 'noopener,noreferrer');
  }, [video.bvid]);

  const createdLabel = video.created
    ? fullCreateTime
      ? dayjs(video.created * 1000).format('YYYY 年 MM 月 DD 日 HH:mm')
      : dayjs(video.created * 1000).fromNow()
    : '';

  return (
    <div
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent/50',
        isPlaying && 'bg-accent',
        className,
      )}
    >
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-muted">
        {!imgError && video.pic ? (
          <img
            src={bilibiliThumbUrl(video.pic, 200, 125)}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PlayCircle className="h-6 w-6" />
          </div>
        )}
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <PlayCircle className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {htmlTitle ? (
          <p
            className="truncate text-sm font-medium [&>em]:not-italic [&>em]:text-primary"
            dangerouslySetInnerHTML={{ __html: video.title }}
          />
        ) : (
          <p className="truncate text-sm font-medium">{video.title}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showAuthor && video.author && (
            <Badge variant="outline" className="font-normal">
              {video.author}
            </Badge>
          )}
          {createdLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {createdLabel}
            </span>
          )}
          {typeof video.play === 'number' && (
            <span className="inline-flex items-center gap-1">
              <Play className="h-3 w-3" />
              {formatNumber10K(video.play)}
            </span>
          )}
          {typeof video.comment === 'number' && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {formatNumber10K(video.comment)}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <TooltipProvider delayDuration={300}>
          {fromSearch ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleAddToFav}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>添加到歌单</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handlePlayClick}>
                  <PlayCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>立即播放</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showAddToPlayBtn && (
                <DropdownMenuItem onSelect={handleAddToPlay}>
                  <Clock className="mr-2 h-4 w-4" />
                  稍后播放
                </DropdownMenuItem>
              )}
              {showAddBtn && (
                <DropdownMenuItem onSelect={handleAddToFav}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加到歌单
                </DropdownMenuItem>
              )}
              {(showAddBtn || showAddToPlayBtn) && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={handleOpenBilibili}>
                <ExternalLink className="mr-2 h-4 w-4" />
                去 B 站看
              </DropdownMenuItem>
              {showRemoveBtn && onRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onRemove(video.bvid)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    移除歌曲
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </div>
  );
}

/**
 * 列表项组件，外层使用虚拟列表/普通列表都会高频重渲染。memo 包装可避免父组件刷新
 * 时无变化的行重复 render；上层回调用 useCallback 包裹是 memo 生效的前提。
 */
export const VideoItem = memo(VideoItemImpl);
