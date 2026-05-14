import { useState } from 'react';
import { MinusSquare, X as XIcon } from 'lucide-react';
import {
  detectPlatformType,
  usePlayerProfileStore,
  type CloseAction,
} from '@shuoshuo-player/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface CloseActionOption {
  value: CloseAction;
  title: string;
  description: string;
  Icon: typeof MinusSquare;
}

const OPTIONS: CloseActionOption[] = [
  {
    value: 'minimize-to-tray',
    title: '隐藏到托盘 / 菜单栏（推荐）',
    description:
      '关闭主窗口后应用继续在后台运行，音乐不会中断。需要彻底退出时，可以右键托盘图标选择"退出"。',
    Icon: MinusSquare,
  },
  {
    value: 'exit',
    title: '直接退出应用',
    description: '保持传统行为：点关闭按钮就结束播放并退出，与浏览器扩展端一致。',
    Icon: XIcon,
  },
];

/**
 * 首次启动引导对话框：让用户为"关闭主窗口"行为做一次决定。
 *
 * 强制约束：
 * - 仅 Tauri 平台渲染（Web/扩展端无系统托盘概念）
 * - 不可 Esc / 外点关闭 / 右上 X 关闭（用户必须二选一）
 * - 默认聚焦"隐藏到托盘"——配合 store 默认值，确保即使用户绕过弹窗，
 *   关闭行为依然是更安全的"隐藏"而非"直接退出"
 *
 * 用户路径：选项 → 点"确定" → setCloseAction + markCloseActionPrompted → 关闭对话框。
 * 之后可以在设置页 → 桌面端 改主意 / 重新触发本对话框。
 */
export function CloseActionOnboardingDialog() {
  const closeActionFirstRunPrompted = usePlayerProfileStore((s) => s.closeActionFirstRunPrompted);
  const currentAction = usePlayerProfileStore((s) => s.closeAction);
  const setCloseAction = usePlayerProfileStore((s) => s.setCloseAction);
  const markCloseActionPrompted = usePlayerProfileStore((s) => s.markCloseActionPrompted);

  // 本地 selection 与 store 的 closeAction 解耦：用户可以反复改选直到点确定
  const [selected, setSelected] = useState<CloseAction>(currentAction);

  const isTauri = detectPlatformType() === 'tauri';
  if (!isTauri || closeActionFirstRunPrompted) return null;

  const handleConfirm = () => {
    setCloseAction(selected);
    markCloseActionPrompted();
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="flex max-w-lg flex-col gap-4 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1.5">
          <DialogTitle>关闭窗口时，希望应用怎么处理？</DialogTitle>
          {/* Radix Dialog 期望存在 DialogDescription 以满足 a11y；用 sr-only 仅暴露给屏幕阅读器 */}
          <DialogDescription className="sr-only">为关闭主窗口选择一种处置方式。</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={(v) => setSelected(v as CloseAction)}
          className="gap-3"
        >
          {OPTIONS.map(({ value, title, description, Icon }) => {
            const id = `close-action-${value}`;
            const active = selected === value;
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

        <DialogFooter>
          <Button size="sm" onClick={handleConfirm}>
            就这么定了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
