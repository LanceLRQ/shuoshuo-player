import { formatTimeLyric } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { LyricLine } from './lyric-table';

/**
 * 暂存歌词只读表格（compare 视图右列使用）
 *
 * 与 LyricTable 的差异：
 *  - 行不可编辑（点击无 input；保留 onSeek 双击跳转）
 *  - 无操作列（暂存的"插入主列表"动作由父级按钮组承担，行级独立选择即可）
 *  - 可选择多行（checkbox），父组件用选中集合实现"插入选中"
 */

interface LyricSuggestedTableProps {
  lines: LyricLine[];
  selectedRows: Set<number>;
  /** 当前播放进度（毫秒），用于行高亮（与主表保持视觉一致） */
  currentMillisecond: number;
  /** 双击行 → 跳转到该时间戳（毫秒），可选 */
  onSeek?: (timeMs: number) => void;
  onToggleSelect: (idx: number, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
}

export function LyricSuggestedTable({
  lines,
  selectedRows,
  currentMillisecond,
  onSeek,
  onToggleSelect,
  onToggleSelectAll,
}: LyricSuggestedTableProps) {
  const allChecked = lines.length > 0 && selectedRows.size === lines.length;
  const currentLineIdx = (() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentMillisecond) idx = i;
      else break;
    }
    return idx;
  })();

  return (
    // 与 LyricTable 同模式：原生 overflow-y-auto + Table wrapper overflow-visible，
    // sticky thead 锚定到外层 div，不依赖 Radix ScrollArea
    <div className="h-full overflow-y-auto">
      <Table wrapperClassName="overflow-visible">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(v) => onToggleSelectAll(!!v)}
                aria-label="全选暂存"
              />
            </TableHead>
            <TableHead className="w-24">时间</TableHead>
            <TableHead>歌词内容</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                暂无暂存歌词
              </TableCell>
            </TableRow>
          ) : (
            lines.map((line, idx) => (
              <TableRow
                key={idx}
                data-state={selectedRows.has(idx) ? 'selected' : undefined}
                className={cn(idx === currentLineIdx && 'bg-primary/10')}
                onDoubleClick={() => onSeek?.(line.time)}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedRows.has(idx)}
                    onCheckedChange={(v) => onToggleSelect(idx, !!v)}
                    aria-label={`选择暂存第 ${idx + 1} 行`}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatTimeLyric(line.time)}
                </TableCell>
                <TableCell className="text-sm">
                  {line.content || <span className="text-muted-foreground">（空）</span>}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
