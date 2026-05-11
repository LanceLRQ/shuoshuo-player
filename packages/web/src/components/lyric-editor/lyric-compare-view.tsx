import { Replace, ListPlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { LyricTable, type LyricLine } from './lyric-table';
import { LyricSuggestedTable } from './lyric-suggested-table';

/**
 * 左右对比视图（compare 模式）：
 *  - 左：当前主歌词（可编辑），复用 LyricTable
 *  - 右：QQ 音乐 / 文件加载得到的暂存歌词（只读 + 多选），LyricSuggestedTable
 *  - 右上方有 4 个操作按钮：覆盖 / 插入选中 / 插入全部 / 清空暂存
 *
 * 操作语义统一由父组件（LyricEditor）实现并传入回调，本组件仅作 UX 容器。
 */

interface LyricCompareViewProps {
  // 主列表（左）
  mainLines: LyricLine[];
  mainSelectedRows: Set<number>;
  currentMillisecond: number;
  onMainSeek: (timeMs: number) => void;
  onMainToggleSelect: (idx: number, selected: boolean) => void;
  onMainToggleSelectAll: (selected: boolean) => void;
  onMainUpdateLine: (idx: number, line: LyricLine) => void;

  // 暂存列表（右）
  suggestedLines: LyricLine[];
  suggestedSelected: Set<number>;
  onSuggestedToggleSelect: (idx: number, selected: boolean) => void;
  onSuggestedToggleSelectAll: (selected: boolean) => void;
  onSuggestedSeek?: (timeMs: number) => void;

  // 操作回调
  onOverwrite: () => void;
  onInsertSelected: () => void;
  onInsertAll: () => void;
  onClearSuggested: () => void;
}

export function LyricCompareView(props: LyricCompareViewProps) {
  const hasSuggestedSelection = props.suggestedSelected.size > 0;
  const hasSuggested = props.suggestedLines.length > 0;

  return (
    // grid 1:1 强对称；min-h-0 + overflow-hidden 让两列各自滚动不撑破容器
    <div className="grid h-full min-h-0 grid-cols-2 gap-2 overflow-hidden">
      {/* 左：主歌词 */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
        {/* h-12：与右栏 icon 按钮（h-8）+ padding 后的总高对齐，避免左低右高的视觉错位 */}
        <div className="flex h-12 flex-none items-center justify-between border-b bg-muted/40 px-3">
          <span className="text-xs font-medium">当前歌词（可编辑）</span>
          <span className="text-xs text-muted-foreground">{props.mainLines.length} 行</span>
        </div>
        <div className="min-h-0 flex-1">
          <LyricTable
            lines={props.mainLines}
            selectedRows={props.mainSelectedRows}
            currentMillisecond={props.currentMillisecond}
            onSeek={props.onMainSeek}
            onToggleSelect={props.onMainToggleSelect}
            onToggleSelectAll={props.onMainToggleSelectAll}
            onUpdateLine={props.onMainUpdateLine}
          />
        </div>
      </div>

      {/* 右：暂存歌词 + 操作按钮组 */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
        {/*
         * 标题 + 4 个操作按钮共占一行：右栏宽度仅 50%，原带文字的 sm 按钮会
         * 触发 flex-wrap 折行，标题与按钮组分离视觉断裂。改为 icon-only Button
         * + Tooltip 兜底语义；min-w-0 + truncate 让标题文字不撑爆容器。
         */}
        <div className="flex flex-none items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <span
            className="min-w-0 truncate text-xs font-medium"
            title="暂存歌词（搜索结果 / 文件加载）"
          >
            暂存歌词
          </span>
          <span className="flex-none text-xs text-muted-foreground">
            {props.suggestedLines.length} 行
          </span>
          <TooltipProvider delayDuration={300}>
            <div className="ml-auto flex flex-none items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={props.onOverwrite}
                    disabled={!hasSuggested}
                    aria-label="覆盖"
                  >
                    <Replace className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>用整个暂存替换主歌词（可撤销）</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={props.onInsertSelected}
                    disabled={!hasSuggestedSelection}
                    aria-label="插入选中"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>把选中行追加进主歌词并按时间排序</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={props.onInsertAll}
                    disabled={!hasSuggested}
                    aria-label="插入全部"
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>把暂存所有行追加进主歌词并按时间排序</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={props.onClearSuggested}
                    disabled={!hasSuggested}
                    aria-label="清空暂存"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>清空暂存并退出对比视图</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="min-h-0 flex-1">
          <LyricSuggestedTable
            lines={props.suggestedLines}
            selectedRows={props.suggestedSelected}
            currentMillisecond={props.currentMillisecond}
            onSeek={props.onSuggestedSeek}
            onToggleSelect={props.onSuggestedToggleSelect}
            onToggleSelectAll={props.onSuggestedToggleSelectAll}
          />
        </div>
      </div>
    </div>
  );
}
