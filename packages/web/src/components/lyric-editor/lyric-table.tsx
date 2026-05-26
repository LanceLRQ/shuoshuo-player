import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { Play } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useRowRangeSelection } from './use-row-range-selection';

export interface LyricLine {
  /** 时间戳（毫秒） */
  time: number;
  content: string;
}

interface LyricTableProps {
  lines: LyricLine[];
  selectedRows: Set<number>;
  /** 选择集 setter：拖动框选 / 修饰键多选直接操作（复选框仍走 onToggleSelect） */
  setSelectedRows: (next: Set<number>) => void;
  /** 当前播放进度（毫秒），用于高亮 */
  currentMillisecond: number;
  /** 是否正在播放：未播放时禁用跳转按钮 */
  isPlaying?: boolean;
  /** 双击行 → 跳转到该时间戳（毫秒） */
  onSeek: (timeMs: number) => void;
  onToggleSelect: (idx: number, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onUpdateLine: (idx: number, line: LyricLine) => void;
}

export function LyricTable({
  lines,
  selectedRows,
  setSelectedRows,
  currentMillisecond,
  isPlaying = false,
  onSeek,
  onToggleSelect,
  onToggleSelectAll,
  onUpdateLine,
}: LyricTableProps) {
  const allChecked = lines.length > 0 && selectedRows.size === lines.length;
  const containerRef = useRef<HTMLDivElement>(null);
  // 编辑态（任一行 input 激活）禁用拖动框选，防误操作
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
  const { getRowHandlers, marquee, suppressNextClick } = useRowRangeSelection({
    selectedRows,
    setSelectedRows,
    rowCount: lines.length,
    containerRef,
    disabled: editingRowIdx !== null,
  });
  // 当前播放行：找到最后一个 time <= currentMillisecond 的行
  const currentLineIdx = (() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentMillisecond) idx = i;
      else break;
    }
    return idx;
  })();

  return (
    // 改用原生 overflow-y-auto div：Radix ScrollArea 的 Viewport 内置一层 display:table
    // 包裹，会破坏 sticky 元素的 containing block；用裸 div 作为滚动祖先 sticky 才稳。
    // wrapperClassName=overflow-visible 取消 Table 自带 overflow-auto wrapper，
    // 让 sticky 直接锚定到外层 div。
    // 不做随播放进度的自动滚动：编辑态下用户需自由翻看/校时间轴，靠双击行对拍即可，
    // 自动跟随会反复把列表拉回当前播放行，打断编辑。
    // relative：作为橡皮筋选框的定位锚点（选框用容器内容坐标定位，随滚动一起移动）。
    <div ref={containerRef} className="relative h-full overflow-y-auto">
      <Table wrapperClassName="overflow-visible">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(v) => onToggleSelectAll(!!v)}
                aria-label="全选"
              />
            </TableHead>
            <TableHead className="w-28">时间</TableHead>
            <TableHead>歌词内容</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                暂无歌词
              </TableCell>
            </TableRow>
          )}
          {lines.map((line, idx) => (
            <EditableRow
              key={idx}
              idx={idx}
              line={line}
              selected={selectedRows.has(idx)}
              isCurrent={idx === currentLineIdx}
              isPlaying={isPlaying}
              onSeek={onSeek}
              onToggleSelect={onToggleSelect}
              onUpdateLine={onUpdateLine}
              rowHandlers={getRowHandlers(idx)}
              suppressNextClick={suppressNextClick}
              onEditingChange={setEditingRowIdx}
            />
          ))}
        </TableBody>
      </Table>
      {marquee && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-0 rounded-sm border border-primary/60 bg-primary/10"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      )}
    </div>
  );
}

function EditableRow({
  idx,
  line,
  selected,
  isCurrent,
  isPlaying,
  onSeek,
  onToggleSelect,
  onUpdateLine,
  rowHandlers,
  suppressNextClick,
  onEditingChange,
}: {
  idx: number;
  line: LyricLine;
  selected: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  onSeek: (timeMs: number) => void;
  onToggleSelect: (idx: number, selected: boolean) => void;
  onUpdateLine: (idx: number, line: LyricLine) => void;
  /** 整行的拖动框选 / 单击选中事件（来自 useRowRangeSelection.getRowHandlers） */
  rowHandlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
  };
  /** 拖动刚结束时为 true，用于吞掉尾随的 dblclick 误触编辑 */
  suppressNextClick: () => boolean;
  /** 上报本行进入/退出编辑态，供父表禁用拖动框选 */
  onEditingChange: (idx: number | null) => void;
}) {
  // 时间格与内容格独立编辑：原先用单一 boolean 会让两侧 Input 同时挂载，
  // 时间 Input 的 autoFocus 抢走焦点，用户点歌词内容也无法输入
  const [editingField, setEditingField] = useState<'time' | 'content' | null>(null);
  const [draftTime, setDraftTime] = useState(formatTimeLyric(line.time));
  const [draftContent, setDraftContent] = useState(line.content);

  useEffect(() => {
    if (editingField === null) {
      setDraftTime(formatTimeLyric(line.time));
      setDraftContent(line.content);
    }
  }, [line, editingField]);

  // 编辑态变化上报父表（父表据此禁用拖动框选）
  useEffect(() => {
    onEditingChange(editingField !== null ? idx : null);
  }, [editingField, idx, onEditingChange]);

  const commit = () => {
    const ms = parseLyricTime(draftTime);
    onUpdateLine(idx, { time: ms ?? line.time, content: draftContent });
    setEditingField(null);
  };

  const cancel = () => {
    setDraftTime(formatTimeLyric(line.time));
    setDraftContent(line.content);
    setEditingField(null);
  };

  return (
    <TableRow
      data-row={idx}
      data-state={selected ? 'selected' : undefined}
      // group：供内容格右侧跳转按钮 hover 显隐。cursor-pointer/select-none：整行可点选、拖动框选不选中文本。
      // 当前播放行用左色条 + 文字色 + 字重标识：这三者不占用 background-color，
      // 与选中态 data-[state=selected]:bg-muted 不冲突，全选调时间轴时仍可辨认当前行。
      // border-l-transparent 常驻占位，避免高亮时行宽跳动。
      className={cn(
        'group cursor-pointer select-none border-l-2 border-l-transparent',
        isCurrent && 'border-l-primary font-medium text-primary',
      )}
      // 整行：单击选中 / 修饰键多选 / 拖动框选（自动排除复选框、输入框、跳转按钮）
      {...rowHandlers}
    >
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggleSelect(idx, !!v)}
          aria-label={`选择第 ${idx + 1} 行`}
        />
      </TableCell>
      <TableCell
        className="font-mono text-xs"
        // 双击进入时间编辑；拖动尾随的 dblclick 不应误进编辑
        onDoubleClick={() => {
          if (suppressNextClick()) return;
          setEditingField('time');
        }}
      >
        {editingField === 'time' ? (
          <Input
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            autoFocus
            className="h-7 w-24 font-mono text-xs"
          />
        ) : (
          formatTimeLyric(line.time)
        )}
      </TableCell>
      <TableCell
        className="relative"
        onDoubleClick={() => {
          if (suppressNextClick()) return;
          setEditingField('content');
        }}
      >
        {editingField === 'content' ? (
          <Input
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            autoFocus
            className="h-7"
          />
        ) : (
          <>
            {line.content || <span className="text-muted-foreground">（空）</span>}
            {/* 跳播放到该句：悬停本行时显示，替代原双击行 seek（双击已改作编辑） */}
            <button
              type="button"
              data-seek-btn
              disabled={!isPlaying}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(line.time);
              }}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 rounded bg-background/80 p-1 transition-opacity',
                // 默认隐藏，悬停显示（无论是否禁用）
                'opacity-0 group-hover:opacity-100',
                isPlaying
                  ? 'text-muted-foreground hover:text-primary cursor-pointer'
                  : 'text-muted-foreground/50 cursor-not-allowed',
              )}
              aria-label={isPlaying ? '跳播放到该句' : '未播放时无法跳转'}
              title={isPlaying ? '跳播放到该句' : '请先播放后再跳转'}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </TableCell>
    </TableRow>
  );
}

/** 解析 LRC 时间标签 MM:SS.CC（厘秒）→ 毫秒 */
function parseLyricTime(input: string): number | null {
  const m = input.match(/^(\d{1,3}):(\d{1,2})[.:](\d{1,3})$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  let frac = m[3];
  // 厘秒补零到毫秒
  if (frac.length === 2) frac = frac + '0';
  if (frac.length === 1) frac = frac + '00';
  const ms = Number(frac);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(ms)) return null;
  return minutes * 60 * 1000 + seconds * 1000 + ms;
}
