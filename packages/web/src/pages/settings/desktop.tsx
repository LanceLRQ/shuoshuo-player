import { MinusSquare, X as XIcon } from 'lucide-react';
import {
  detectPlatformType,
  usePlayerProfileStore,
  type CloseAction,
} from '@shuoshuo-player/shared';
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card';
import { SectionTitle } from './_components';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CacheSettings } from './cache';

interface CloseActionOption {
  value: CloseAction;
  title: string;
  description: string;
  Icon: typeof MinusSquare;
}

const OPTIONS: CloseActionOption[] = [
  {
    value: 'minimize-to-tray',
    title: '隐藏到托盘 / 菜单栏',
    description:
      '关闭主窗口时应用继续在后台运行，音乐不会中断。需要退出请用托盘菜单或 macOS Dock 右键 Quit。',
    Icon: MinusSquare,
  },
  {
    value: 'exit',
    title: '直接退出应用',
    description: '关闭主窗口即结束播放并退出进程。与浏览器扩展端体验一致。',
    Icon: XIcon,
  },
];

/**
 * 桌面端专属设置（仅 Tauri）：
 * - 切换主窗口关闭按钮行为
 * - 音频缓存管理（嵌入 CacheSettings 模块）
 *
 * 平台守卫：非 Tauri 渲染占位。理论上 SettingsPage 已经按平台筛过 tab，
 * 这里兜底防御直接通过 URL ?tab=desktop 访问到该面板。
 */
export function DesktopSettings() {
  const isTauri = detectPlatformType() === 'tauri';
  const closeAction = usePlayerProfileStore((s) => s.closeAction);
  const setCloseAction = usePlayerProfileStore((s) => s.setCloseAction);

  if (!isTauri) {
    return (
      <Card>
        <CardHeader>
          <SectionTitle>桌面端</SectionTitle>
          <CardDescription>这些设置只在桌面端有效，浏览器扩展无需配置。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <SectionTitle>关闭主窗口时</SectionTitle>
          <CardDescription>
            选择点关闭按钮时应用的处置方式。隐藏到托盘可以让音乐在后台继续播放。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={closeAction}
            onValueChange={(v) => setCloseAction(v as CloseAction)}
            className="gap-3"
          >
            {OPTIONS.map(({ value, title, description, Icon }) => {
              const id = `close-action-${value}`;
              const active = closeAction === value;
              return (
                <Label
                  key={value}
                  htmlFor={id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/60 hover:bg-muted/50',
                  )}
                >
                  <RadioGroupItem value={value} id={id} className="mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {title}
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      <CacheSettings />
    </div>
  );
}
