import { Pin } from 'lucide-react';
import { formatPlayTime, type BilibiliVideoPage } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export interface PartListProps {
  pages: BilibiliVideoPage[];
  /** 当前实际播放的 P；0 视为不渲染播放高亮 */
  activePage: number;
  onSelect: (page: number) => void;
  /** popover：SPlayer 控制条卡片；inline：PlayingQueue 折叠缩进 */
  variant?: 'popover' | 'inline';
  className?: string;
  /* —— 以下 props 仅在 variant='popover' 时生效；inline 保持精简形态 —— */
  /** 多选模式：行点击改为切勾选 */
  selectable?: boolean;
  selectedPages?: Set<number>;
  onToggleSelect?: (page: number) => void;
  /** 当前默认 P（>=2 时点亮该行 Pin） */
  defaultPage?: number;
  /** 点击 Pin toggle 默认 P；未提供时不渲染 Pin 列 */
  onTogglePin?: (page: number) => void;
  /** 整列 Pin 置灰（用于显式 bvid:p<n> 上下文） */
  pinDisabled?: boolean;
  pinDisabledReason?: string;
  /** 显式隐藏 Pin 列（如 PagesPickerDialog 复用场景） */
  hidePinColumn?: boolean;
  /** 显式隐藏播放高亮（dialog 场景：不绑定当前播放） */
  hideActiveHighlight?: boolean;
}

/**
 * 多 P 列表渲染：
 * - popover 变体支持多选 + Pin；inline 变体（PlayingQueue）保持单选 + 精简
 * - 同源单条渲染避免多处重复
 */
export function PartList({
  pages,
  activePage,
  onSelect,
  variant = 'popover',
  className,
  selectable = false,
  selectedPages,
  onToggleSelect,
  defaultPage,
  onTogglePin,
  pinDisabled = false,
  pinDisabledReason,
  hidePinColumn = false,
  hideActiveHighlight = false,
}: PartListProps) {
  const isPopover = variant === 'popover';
  const showPinColumn = isPopover && !hidePinColumn && typeof onTogglePin === 'function';
  const showCheckbox = isPopover && selectable;

  const wrapperClass = isPopover
    ? 'flex max-h-72 flex-col gap-px overflow-y-auto'
    : 'ml-20 flex flex-col gap-px border-l border-border/60 py-1 pl-2 pr-2 text-xs';
  const itemPad = isPopover ? 'px-2 py-1.5 text-sm' : 'px-2 py-1';

  const handleRowClick = (page: number) => {
    if (showCheckbox) onToggleSelect?.(page);
    else onSelect(page);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <ul
        role="listbox"
        aria-multiselectable={showCheckbox || undefined}
        className={cn(wrapperClass, className)}
      >
        {pages.map((p) => {
          const isActive = !hideActiveHighlight && p.page === activePage;
          const isChecked = selectedPages?.has(p.page) ?? false;
          const isDefault =
            typeof defaultPage === 'number' && defaultPage >= 2 && defaultPage === p.page;
          // P1 不能 pin（默认即 P1，冗余）；显式上下文整列置灰
          const pinUnavailable = pinDisabled || p.page === 1;

          return (
            <li key={p.cid}>
              <div
                role="option"
                aria-selected={showCheckbox ? isChecked : isActive}
                onClick={() => handleRowClick(p.page)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded text-left transition-colors hover:bg-accent',
                  itemPad,
                  isActive && 'bg-primary/15 font-medium text-primary',
                )}
                aria-label={`${showCheckbox ? '选择' : '播放'} P${p.page}：${p.part || `分P ${p.page}`}`}
              >
                {showCheckbox && (
                  <span onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => onToggleSelect?.(p.page)}
                      aria-label={isChecked ? `取消选择 P${p.page}` : `选择 P${p.page}`}
                    />
                  </span>
                )}
                <span className="shrink-0 tabular-nums text-muted-foreground">P{p.page}</span>
                <span className="min-w-0 flex-1 truncate">{p.part || `分P ${p.page}`}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {formatPlayTime(p.duration)}
                </span>
                {showPinColumn && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pinUnavailable) return;
                          onTogglePin?.(p.page);
                        }}
                        disabled={pinUnavailable}
                        aria-label={isDefault ? `清除默认 P${p.page}` : `设为默认 P${p.page}`}
                        className={cn(
                          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
                          pinUnavailable
                            ? 'opacity-30'
                            : isDefault
                              ? 'text-primary hover:bg-primary/10'
                              : 'text-muted-foreground/60 hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <Pin className={cn('h-3.5 w-3.5', isDefault && 'fill-current')} />
                      </button>
                    </TooltipTrigger>
                    {pinUnavailable && (
                      <TooltipContent>
                        {pinDisabled
                          ? (pinDisabledReason ?? '该上下文不支持设置默认 P')
                          : 'P1 即默认 P，无需固定'}
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
