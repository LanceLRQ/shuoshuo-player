import { useVideoPagePrefStore, type BilibiliVideo } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';

export interface PartBadgeProps {
  video: BilibiliVideo;
  /**
   * 显式 P（来自 TrackId 的 :p<n> 部分）；undefined 表示该条目是纯 bvid，
   * 角标取决于偏好 store 中的默认 P。
   */
  explicitPage?: number;
  className?: string;
}

/**
 * 多 P 视频投稿的角标三态（§5.1 列表语义边界，纯数字版）：
 *
 * 视觉强度递增：中性灰（仅信息）→ 主色淡底（已选偏好）→ 主色实边（显式锚定）
 * 文案统一 `{当前播放 P}/{总 P}`，避免封面小尺寸下中文换行。
 */
export function PartBadge({ video, explicitPage, className }: PartBadgeProps) {
  const totalP = video.videos ?? 1;
  const defaultPage = useVideoPagePrefStore((s) => s.defaultPage[video.bvid] ?? 1);

  if (totalP <= 1) return null;

  const baseClass = 'rounded px-1 py-0 text-[10px] font-medium leading-tight tabular-nums';

  if (typeof explicitPage === 'number' && explicitPage >= 2) {
    return (
      <span
        className={cn(
          baseClass,
          'border border-primary/60 bg-background/85 text-primary',
          className,
        )}
        aria-label={`显式分 P：P${explicitPage} / 共 ${totalP}P`}
      >
        {explicitPage}/{totalP}
      </span>
    );
  }

  if (defaultPage >= 2 && defaultPage <= totalP) {
    return (
      <span
        className={cn(baseClass, 'border border-primary/30 bg-primary/15 text-primary', className)}
        aria-label={`默认播放分 P：P${defaultPage} / 共 ${totalP}P`}
      >
        {defaultPage}/{totalP}
      </span>
    );
  }

  return (
    <span
      className={cn(baseClass, 'bg-muted text-muted-foreground', className)}
      aria-label={`多分 P 视频：共 ${totalP}P，当前默认 1P`}
    >
      1/{totalP}
    </span>
  );
}
