import { useEffect, useRef, useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

export interface LyricLine {
  /** 时间戳（毫秒） */
  time: number;
  content: string;
}

interface LyricTableProps {
  lines: LyricLine[];
  selectedRows: Set<number>;
  /** 当前播放进度（毫秒），用于高亮 */
  currentMillisecond: number;
  /** 双击行 → 跳转到该时间戳（毫秒） */
  onSeek: (timeMs: number) => void;
  onToggleSelect: (idx: number, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onUpdateLine: (idx: number, line: LyricLine) => void;
}

export function LyricTable({
  lines,
  selectedRows,
  currentMillisecond,
  onSeek,
  onToggleSelect,
  onToggleSelectAll,
  onUpdateLine,
}: LyricTableProps) {
  const allChecked = lines.length > 0 && selectedRows.size === lines.length;
  // 当前播放行：找到最后一个 time <= currentMillisecond 的行
  const currentLineIdx = (() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentMillisecond) idx = i;
      else break;
    }
    return idx;
  })();

  const containerRef = useRef<HTMLDivElement>(null);

  // 当前行变化时滚动到视图（仅当播放器在驱动）
  useEffect(() => {
    if (currentLineIdx < 0) return;
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-row="${currentLineIdx}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentLineIdx]);

  return (
    <ScrollArea className="h-full">
      <div ref={containerRef}>
        <Table>
          <TableHeader>
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
                onSeek={onSeek}
                onToggleSelect={onToggleSelect}
                onUpdateLine={onUpdateLine}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}

function EditableRow({
  idx,
  line,
  selected,
  isCurrent,
  onSeek,
  onToggleSelect,
  onUpdateLine,
}: {
  idx: number;
  line: LyricLine;
  selected: boolean;
  isCurrent: boolean;
  onSeek: (timeMs: number) => void;
  onToggleSelect: (idx: number, selected: boolean) => void;
  onUpdateLine: (idx: number, line: LyricLine) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTime, setDraftTime] = useState(formatTimeLyric(line.time));
  const [draftContent, setDraftContent] = useState(line.content);

  useEffect(() => {
    if (!editing) {
      setDraftTime(formatTimeLyric(line.time));
      setDraftContent(line.content);
    }
  }, [line, editing]);

  const commit = () => {
    const ms = parseLyricTime(draftTime);
    onUpdateLine(idx, { time: ms ?? line.time, content: draftContent });
    setEditing(false);
  };

  return (
    <TableRow
      data-row={idx}
      data-state={selected ? 'selected' : undefined}
      className={cn(isCurrent && 'bg-primary/10')}
      onDoubleClick={() => onSeek(line.time)}
    >
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggleSelect(idx, !!v)}
          aria-label={`选择第 ${idx + 1} 行`}
        />
      </TableCell>
      <TableCell
        className="cursor-text font-mono text-xs"
        onClick={() => setEditing(true)}
      >
        {editing ? (
          <Input
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            className="h-7 w-24 font-mono text-xs"
          />
        ) : (
          formatTimeLyric(line.time)
        )}
      </TableCell>
      <TableCell className="cursor-text" onClick={() => setEditing(true)}>
        {editing ? (
          <Input
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="h-7"
          />
        ) : (
          line.content || <span className="text-muted-foreground">（空）</span>
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
