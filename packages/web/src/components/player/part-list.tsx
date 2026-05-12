import { formatPlayTime, type BilibiliVideoPage } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';

interface PartListProps {
  pages: BilibiliVideoPage[];
  /** 当前实际播放的 P；非高亮场景传 0 */
  activePage: number;
  onSelect: (page: number) => void;
  /** 容器变体：popover 用于 SPlayer 卡片样式；inline 用于 PlayingQueue 缩进侧线 */
  variant?: 'popover' | 'inline';
  className?: string;
}

/**
 * 多 P 列表渲染（SPlayer P 选择器与 PlayingQueue 展开复用）。
 *
 * 共享语义：P{n} 前缀 + part 标题 + 时长 + 当前 P 高亮 + listbox role / aria-current。
 * 仅容器样式与 padding 因 variant 切换。
 */
export function PartList({
  pages,
  activePage,
  onSelect,
  variant = 'popover',
  className,
}: PartListProps) {
  const wrapperClass =
    variant === 'inline'
      ? 'ml-20 flex flex-col gap-px border-l border-border/60 py-1 pl-2 pr-2 text-xs'
      : 'flex max-h-72 flex-col gap-px overflow-y-auto';
  const itemPad = variant === 'inline' ? 'px-2 py-1' : 'px-2 py-1.5 text-sm';

  return (
    <ul role="listbox" className={cn(wrapperClass, className)}>
      {pages.map((p) => {
        const isActive = p.page === activePage;
        return (
          <li key={p.cid}>
            <button
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => onSelect(p.page)}
              className={cn(
                'flex w-full items-center gap-2 rounded text-left transition-colors hover:bg-accent',
                itemPad,
                isActive && 'bg-primary/15 font-medium text-primary',
              )}
              aria-label={`播放 P${p.page}：${p.part || `分P ${p.page}`}`}
            >
              <span className="shrink-0 tabular-nums text-muted-foreground">P{p.page}</span>
              <span className="min-w-0 flex-1 truncate">{p.part || `分P ${p.page}`}</span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatPlayTime(p.duration)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
