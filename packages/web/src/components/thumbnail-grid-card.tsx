import { memo, useState } from 'react';
import {
  Play,
  PlayCircle,
  Star,
  Clock,
  Plus,
  Layers,
  Pin,
  PinOff,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { bilibiliThumbUrl, type BilibiliVideo } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import { PartBadge } from './part-badge';
import { useVideoItemActions } from '@/hooks/use-video-item-actions';

export interface ThumbnailGridCardProps {
  video: BilibiliVideo;
  /** 显式分 P（CUSTOM/favorites 歌单条目可能带 :p<n>），透传给 PartBadge 角标与操作 hook */
  explicitPage?: number;
  /** 是否为当前正在播放条目（高亮态） */
  isPlaying?: boolean;
  onClick: () => void;
  /** 存在则渲染「移除歌曲」菜单项（仅歌单内注入；回调内部已含确认弹窗） */
  onRemove?: () => void;
}

function ThumbnailGridCardImpl({
  video,
  explicitPage,
  isPlaying,
  onClick,
  onRemove,
}: ThumbnailGridCardProps) {
  const [imgError, setImgError] = useState(false);
  const isInvalid = video.invalid === true;
  const actions = useVideoItemActions(video, explicitPage);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={isInvalid}>
        <button
          type="button"
          onClick={onClick}
          disabled={isInvalid}
          // group/card：让 hover overlay 仅响应本卡 hover，与外层虚拟行隔离
          className={cn(
            'group/card flex w-full flex-col gap-1.5 rounded-md p-1 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !isInvalid && 'hover:bg-accent/50',
            isInvalid && 'cursor-default',
            isPlaying && 'bg-accent',
          )}
          aria-label={isInvalid ? `${video.title}（已失效）` : `播放 ${video.title}`}
        >
          <div
            className={cn(
              'relative aspect-[3/2] w-full overflow-hidden rounded bg-muted',
              isInvalid && 'grayscale',
            )}
          >
            {!imgError && video.pic ? (
              <img
                // 300x200 = 3:2，object-cover 裁切宽度填满；bilibiliThumbUrl 内部已 urlPrefixFixed
                src={bilibiliThumbUrl(video.pic, 300, 200)}
                alt={video.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-105"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <PlayCircle className="h-8 w-8" />
              </div>
            )}

            {isInvalid && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
                <Badge variant="destructive" className="text-[10px]">
                  已失效
                </Badge>
              </div>
            )}

            {/* hover / 播放中 显示播放按钮（失效态不显示） */}
            {!isInvalid && (
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-150',
                  isPlaying ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100',
                )}
              >
                <PlayCircle className="h-10 w-10 text-white" />
              </div>
            )}

            {/* 多 P 角标（单 P 时 PartBadge 内部返回 null） */}
            <div className="pointer-events-none absolute bottom-1 right-1">
              <PartBadge video={video} explicitPage={explicitPage} />
            </div>
          </div>

          <p
            className={cn(
              'line-clamp-2 text-sm font-medium leading-snug',
              isInvalid && 'opacity-60',
            )}
          >
            {video.title}
          </p>
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onClick}>
          <Play className="mr-2 h-4 w-4" />
          播放
        </ContextMenuItem>
        <ContextMenuItem onSelect={actions.toggleLike}>
          <Star
            className={cn('mr-2 h-4 w-4', actions.isFavored && 'fill-current text-yellow-500')}
          />
          {actions.isFavored ? '取消收藏' : '收藏'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={actions.addToPlay}>
          <Clock className="mr-2 h-4 w-4" />
          稍后播放
        </ContextMenuItem>
        <ContextMenuItem onSelect={actions.addToFav}>
          <Plus className="mr-2 h-4 w-4" />
          添加到歌单
        </ContextMenuItem>
        {actions.isMultiPart && (
          <ContextMenuItem onSelect={actions.openPagesPicker}>
            <Layers className="mr-2 h-4 w-4" />
            选择分 P 添加到歌单
          </ContextMenuItem>
        )}
        {actions.isMultiPart && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Pin className="mr-2 h-4 w-4" />
              记住默认 P{actions.defaultPage >= 2 ? `（当前 P${actions.defaultPage}）` : ''}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-[60vh] w-64 overflow-y-auto">
              {actions.partItems.map((it) => (
                <ContextMenuItem
                  key={`pin-${it.key}`}
                  onSelect={() => actions.pinDefaultPage(it.page)}
                  className="min-w-0"
                >
                  <span
                    className={cn(
                      'mr-2 shrink-0 tabular-nums',
                      actions.defaultPage === it.page
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    P{it.page}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{it.part || `分P ${it.page}`}</span>
                </ContextMenuItem>
              ))}
              {actions.defaultPage >= 2 && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => actions.pinDefaultPage(1)}>
                    <PinOff className="mr-2 h-4 w-4" />
                    清除默认 P 设置
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuItem onSelect={actions.openBilibili}>
          <ExternalLink className="mr-2 h-4 w-4" />去 B 站看
        </ContextMenuItem>
        {onRemove && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              移除歌曲
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * 缩略图网格单卡：3:2 封面 + 标题 + 右键菜单（收藏/稍后播放/添加歌单/分P/去B站/移除）。
 * memo 包装避免虚拟网格滚动时未变化的卡重复 render。
 */
export const ThumbnailGridCard = memo(ThumbnailGridCardImpl);
