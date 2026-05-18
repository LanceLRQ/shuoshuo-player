import { memo, useState } from 'react';
import { Music } from 'lucide-react';
import { bilibiliThumbUrl, urlPrefixFixed, type UploaderCollection } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SeasonCardProps {
  collection: UploaderCollection;
  onClick?: (collection: UploaderCollection) => void;
  className?: string;
}

/**
 * 合集 / 系列卡片：UP 主歌单页「合集」Tab 列表态的网格条目。
 *
 * UI 不区分合集（season）和系列（series），按 B 站 UP 主页惯例统称"合集"。
 * 封面缺失时退化为「灰底 + 名称首字 + Music icon」占位。
 */
function SeasonCardImpl({ collection, onClick, className }: SeasonCardProps) {
  const [imgError, setImgError] = useState(false);
  const hasCover = Boolean(collection.cover) && !imgError;
  const initial = collection.name ? [...collection.name][0] : '?';

  return (
    <button
      type="button"
      onClick={() => onClick?.(collection)}
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg border bg-card text-left text-card-foreground transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      aria-label={`打开合集 ${collection.name}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {hasCover ? (
          <img
            src={bilibiliThumbUrl(urlPrefixFixed(collection.cover), 400, 400)}
            alt={collection.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/60 text-muted-foreground">
            <Music className="h-8 w-8" />
            <span className="text-2xl font-semibold">{initial}</span>
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute right-2 top-2 bg-background/85 backdrop-blur-sm"
        >
          {collection.total} 首
        </Badge>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h4 className="line-clamp-2 text-sm font-semibold leading-tight" title={collection.name}>
          {collection.name}
        </h4>
        {collection.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground" title={collection.description}>
            {collection.description}
          </p>
        )}
      </div>
    </button>
  );
}

export const SeasonCard = memo(SeasonCardImpl);
