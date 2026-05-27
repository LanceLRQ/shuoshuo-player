import { useState } from 'react';
import {
  HelpCircle,
  ChevronsLeft,
  ChevronLeft,
  Plus,
  Minus,
  Undo,
  Search,
  Columns2,
  Code2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { HelpSection, type HelpItem } from '@/components/help-section';

const MOUSE_ITEMS: HelpItem[] = [
  { action: '单击', title: '选中一行', desc: '选中点到的这一行' },
  {
    action: 'Ctrl / ⌘ + 单击',
    title: '加选 / 取消',
    desc: '允许选择不连续的行，再点一次取消该行',
  },
  { action: 'Shift + 单击', title: '连续选择', desc: '从上次选中的行一直选到当前行' },
  {
    action: '按住拖动',
    title: '框选一段',
    desc: '稍微按住再拖动可框选连续多行；轻点不会误触（按住 ⌘/Ctrl 拖动则是追加到已选）',
  },
  { action: '双击时间', title: '改时间', desc: '编辑该行时间，格式 分:秒.毫秒（如 00:12.50）' },
  { action: '双击歌词', title: '改文字', desc: '编辑该行歌词内容' },
  {
    action: '回车 / Esc',
    title: '保存 / 取消编辑',
    desc: '编辑中回车保存、Esc 取消，点到别处也会自动保存',
  },
  {
    action: '悬停 ▶',
    title: '跳到这句',
    desc: '鼠标移到行尾出现的播放按钮，点一下跳到该句播放（需正在播放）',
  },
  { action: '表头勾选框', title: '全选 / 取消', desc: '一键勾选或清空所有行' },
];

const TOOLBAR_ITEMS: HelpItem[] = [
  {
    icon: ChevronsLeft,
    title: '整体提前 / 延后',
    desc: '把所有歌词的时间统一往前或往后挪，挪动量看中间的步长输入框（单位毫秒，可自己改）',
  },
  {
    icon: ChevronLeft,
    title: '选中行提前 / 延后',
    desc: '只挪动当前选中的行，需先选好行',
  },
  {
    icon: Plus,
    title: '在当前位置插入',
    desc: '按当前播放进度插入一行空歌词，适合边听边打轴',
  },
  {
    icon: Minus,
    title: '删除 / 清空选择 / 清空全部',
    desc: '删除选中行、清空当前选择，或清空全部歌词（清空可撤销，需保存后才生效）',
  },
  { icon: Undo, title: '撤销', desc: '逐步回退之前的编辑操作' },
  {
    icon: Search,
    title: '搜索 QQ 音乐歌词',
    desc: '按歌名搜歌词并导入（仅桌面端提供）',
  },
  {
    icon: Columns2,
    title: '单 / 左右对比视图',
    desc: '搜索或加载歌词到暂存后出现，可左右对比，再选择整体覆盖或插入选中行',
  },
  { icon: Code2, title: '编辑源代码', desc: '直接编辑 LRC 文本，保存时校验格式' },
  {
    icon: Upload,
    title: '文件操作',
    desc: '从文件加载、保存到本地、下载为 LRC 文件；上传到云端需要水晶蟹小屋管理员权限',
  },
];

const TIP_ITEMS: HelpItem[] = [
  { title: '记得保存', desc: '所有改动要点「保存到本地」才生效；没保存就退出会有提示' },
  {
    title: '不怕放完切歌',
    desc: '编辑期间当前这首播完会自动循环，不会自动切到下一首，避免改动丢失',
  },
];

/**
 * 歌词编辑器使用说明：自包含开关 + 触发按钮，供 LyricToolbar 直接渲染，
 * 不向工具栏注入额外 props。内容覆盖鼠标交互、工具栏功能与使用提示。
 */
export function LyricHelpDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="使用说明">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>使用说明</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>歌词编辑器使用说明</DialogTitle>
          <DialogDescription>鼠标操作、工具栏功能与实用提示一览。</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            <HelpSection title="鼠标操作" items={MOUSE_ITEMS} />
            <Separator />
            <HelpSection title="工具栏功能" items={TOOLBAR_ITEMS} />
            <Separator />
            <HelpSection title="小贴士" items={TIP_ITEMS} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
