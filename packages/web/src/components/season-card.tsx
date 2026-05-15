import { memo, useState } from 'react';
import { Music } from 'lucide-react';
import { bilibiliThumbUrl, urlPrefixFixed, type UploaderSeason } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SeasonCardProps {
  season: UploaderSeason;
  onClick?: (seasonId: number) => void;
  className?: string;
}

/**
 * 合集卡片：UP 主歌单页「合集」Tab 列表态的网格条目。
 *
 * 视觉：方形封面（aspect-square）+ 标题两行截断 + 视频数 badge + 描述单行截断。
 * 封面缺失时退化为「灰底 + 合集名首字 + Music icon」占位，与 fav-card 一致的容错策略。
 */
function SeasonCardImpl({ season, onClick, className }: SeasonCardProps) {
  const [imgError, setImgError] = useState(false);
  const { meta, effectiveCover } = season;
  const hasCover = Boolean(effectiveCover) && !imgError;
  const initial = meta.name ? [...meta.name][0] : '?';

  return (
    <button
      type="button"
      onClick={() => onClick?.(meta.season_id)}
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg border bg-card text-left text-card-foreground transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      aria-label={`打开合集 ${meta.name}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {hasCover ? (
          <img
            src={bilibiliThumbUrl(urlPrefixFixed(effectiveCover), 400, 400)}
            alt={meta.name}
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
          {meta.total} 首
        </Badge>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h4 className="line-clamp-2 text-sm font-semibold leading-tight" title={meta.name}>
          {meta.name}
        </h4>
        {meta.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground" title={meta.description}>
            {meta.description}
          </p>
        )}
      </div>
    </button>
  );
}

export const SeasonCard = memo(SeasonCardImpl);
