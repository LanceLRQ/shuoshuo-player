import { memo, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { bilibiliThumbUrl, type BilibiliVideo } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PartBadge } from './part-badge';

export interface ThumbnailGridCardProps {
  video: BilibiliVideo;
  /** 显式分 P（CUSTOM/favorites 歌单条目可能带 :p<n>），透传给 PartBadge 角标 */
  explicitPage?: number;
  /** 是否为当前正在播放条目（高亮态） */
  isPlaying?: boolean;
  onClick: () => void;
}

function ThumbnailGridCardImpl({
  video,
  explicitPage,
  isPlaying,
  onClick,
}: ThumbnailGridCardProps) {
  const [imgError, setImgError] = useState(false);
  const isInvalid = video.invalid === true;

  return (
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

      <p className={cn('line-clamp-2 text-sm font-medium leading-snug', isInvalid && 'opacity-60')}>
        {video.title}
      </p>
    </button>
  );
}

/**
 * 缩略图网格单卡：3:2 封面 + 标题。功能刻意精简（仅播放），区别于功能繁重的 VideoItem。
 * memo 包装避免虚拟网格滚动时未变化的卡重复 render。
 */
export const ThumbnailGridCard = memo(ThumbnailGridCardImpl);
