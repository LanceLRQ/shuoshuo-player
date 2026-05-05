import {
  ArrowLeft,
  Search,
  Upload,
  Save,
  CloudUpload,
  Download,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  ListX,
  Undo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export interface LyricToolbarProps {
  customStep: number;
  onCustomStepChange: (val: number) => void;
  hasSelection: boolean;
  hasHistory: boolean;
  isAdmin: boolean;
  hasSpider: boolean;

  onExit: () => void;
  /** 嵌入 Dialog 时由外层关闭按钮承担退出，避免双入口冗余 */
  hideExit?: boolean;
  onSearch: () => void;
  onLoadFromFile: () => void;
  onSaveLocal: () => void;
  onUploadCloud: () => void;
  onDownloadLrc: () => void;
  onShiftAll: (deltaMs: number) => void;
  onShiftSelected: (deltaMs: number) => void;
  onInsertHere: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onUndo: () => void;
}

export function LyricToolbar(props: LyricToolbarProps) {
  const step = props.customStep;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-background px-3 py-2">
      <TooltipProvider delayDuration={300}>
        {!props.hideExit && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={props.onExit}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>退出编辑器</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="mx-1 h-6" />
          </>
        )}

        {/*
         * 搜索按钮依赖 PlatformBridge.spider（仅 Tauri 提供）。
         * 浏览器端 spider=undefined → hasSpider=false → 不渲染按钮（也不渲染后置分隔条），
         * 避免摆出一个永久 disabled 的"诱饵"按钮。
         */}
        {props.hasSpider && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={props.onSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>搜索 QQ 音乐歌词</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="mx-1 h-6" />
          </>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => props.onShiftAll(-step)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>整体歌词提前 {step}ms</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => props.onShiftAll(step)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>整体歌词延后 {step}ms</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => props.onShiftSelected(-step)}
              disabled={!props.hasSelection}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>选中行提前 {step}ms</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => props.onShiftSelected(step)}
              disabled={!props.hasSelection}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>选中行延后 {step}ms</TooltipContent>
        </Tooltip>

        <Input
          type="number"
          value={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            props.onCustomStepChange(Number.isFinite(v) ? Math.max(1, Math.min(99999, v)) : 500);
          }}
          min={1}
          max={99999}
          className="h-8 w-20 text-center"
          aria-label="自定义步长"
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={props.onInsertHere}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>在当前位置插入行</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onDeleteSelected}
              disabled={!props.hasSelection}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>删除选中行</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onClearSelection}
              disabled={!props.hasSelection}
            >
              <ListX className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>清空选择</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={props.onUndo} disabled={!props.hasHistory}>
              <Undo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>撤销</TooltipContent>
        </Tooltip>

        {/*
         * 文件 IO 组：ml-auto 推至最右，与编辑/时移/撤销视觉解耦。
         * 内层 flex 包一组按钮 → 在 flex-wrap 容器中作为单个不可拆 item，窄屏会整体折行仍保持右对齐。
         */}
        <div className="ml-auto flex items-center gap-1" data-testid="lyric-toolbar-io-group">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={props.onLoadFromFile}>
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>从文件加载 LRC</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={props.onSaveLocal}>
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>保存到本地</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onUploadCloud}
                disabled={!props.isAdmin}
              >
                <CloudUpload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{props.isAdmin ? '上传到云端' : '需要管理员权限'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={props.onDownloadLrc}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下载 LRC 文件</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
