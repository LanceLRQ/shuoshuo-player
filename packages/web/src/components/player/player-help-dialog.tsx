import { useState } from 'react';
import {
  HelpCircle,
  Play,
  SkipForward,
  Clock,
  Volume2,
  Repeat,
  Repeat1,
  RepeatOff,
  Shuffle,
  Expand,
  Captions,
  AudioLines,
  ListMusic,
  Layers,
  Plus,
  ExternalLink,
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

const PLAY_CONTROL_ITEMS: HelpItem[] = [
  { icon: Play, title: '播放 / 暂停', desc: '播放或暂停，电脑媒体键、锁屏控件也能控制' },
  { icon: SkipForward, title: '上一首 / 下一首', desc: '播放键两侧可以切歌' },
  { icon: Clock, title: '调整进度', desc: '拖动进度条跳到歌曲的任意位置' },
  { icon: Volume2, title: '音量', desc: '拖动滑块调节音量' },
];

const LOOP_MODE_ITEMS: HelpItem[] = [
  { icon: Repeat, title: '列表循环', desc: '循环当前的播放列表' },
  { icon: Shuffle, title: '随机播放', desc: '随机挑选下一首播放' },
  { icon: Repeat1, title: '单曲循环', desc: '循环播放当前音乐' },
  { icon: RepeatOff, title: '播完就停', desc: '当前这首音乐播完就停止' },
];

const LYRIC_AUDIO_ITEMS: HelpItem[] = [
  { icon: Expand, title: '全屏歌词', desc: '点击播放器左侧封面，即可展开歌词界面；' },
  { icon: Captions, title: '悬浮歌词', desc: '在播放栏上方显示当前当前位置的歌词' },
  {
    icon: AudioLines,
    title: '音质',
    desc: '为当前音乐选择播放音质；全局默认音质在「设置」里调',
  },
];

const MORE_ITEMS: HelpItem[] = [
  { icon: ListMusic, title: '播放列表', desc: '查看与管理当前的待播音乐' },
  { icon: Layers, title: '选择分 P', desc: '如果当前播放的音乐存在多个P的视频，可切换到指定P' },
  { icon: Plus, title: '添加到歌单', desc: '把当前歌曲收藏进自定义歌单' },
  { icon: ExternalLink, title: '去 B 站', desc: '使用浏览器打开当前音乐所在的B站源地址' },
];

/**
 * 播放器使用说明：自包含开关 + 触发按钮，供顶栏直接渲染（不注入额外 props）。
 * 覆盖播放控制、循环模式、歌词与音质、更多操作。
 */
export function PlayerHelpDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="使用帮助">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>使用帮助</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>播放器使用帮助</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            <HelpSection title="播放控制" items={PLAY_CONTROL_ITEMS} />
            <Separator />
            <HelpSection title="播放模式（循环按钮逐次切换）" items={LOOP_MODE_ITEMS} />
            <Separator />
            <HelpSection title="歌词与音质" items={LYRIC_AUDIO_ITEMS} />
            <Separator />
            <HelpSection title="更多操作" items={MORE_ITEMS} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
