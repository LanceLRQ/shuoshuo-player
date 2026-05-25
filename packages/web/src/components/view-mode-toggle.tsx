import { List, LayoutGrid } from 'lucide-react';
import type { VideoListViewMode } from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ViewModeToggleProps {
  value: VideoListViewMode;
  onChange: (mode: VideoListViewMode) => void;
  className?: string;
}

/** 列表 / 缩略图视图切换：两个相邻 icon 按钮，选中态用 secondary 高亮 */
export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={cn('inline-flex shrink-0 overflow-hidden rounded-md border', className)}
      role="group"
    >
      <Button
        variant={value === 'list' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-9 w-9 rounded-none"
        aria-label="列表视图"
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={value === 'thumbnail' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-9 w-9 rounded-none"
        aria-label="缩略图视图"
        aria-pressed={value === 'thumbnail'}
        onClick={() => onChange('thumbnail')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
