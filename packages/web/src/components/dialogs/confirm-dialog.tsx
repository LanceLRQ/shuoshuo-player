import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useUIShell } from '@/stores/ui-shell';

/**
 * 全局通用确认弹窗，由 useUIShell.openConfirm({...}) 触发。
 *
 * 调用方传入 onConfirm 回调；若返回 Promise，期间按钮 disabled。
 */
export function ConfirmDialog() {
  const open = useUIShell((s) => s.confirmOpen);
  const config = useUIShell((s) => s.confirmConfig);
  const closeConfirm = useUIShell((s) => s.closeConfirm);
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    if (!config) return;
    try {
      setPending(true);
      await config.onConfirm();
    } finally {
      setPending(false);
      closeConfirm();
    }
  };

  const handleCancel = () => {
    config?.onCancel?.();
    closeConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => (o ? null : closeConfirm())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config?.title ?? '确认操作'}</AlertDialogTitle>
          {config?.description && (
            <AlertDialogDescription>{config.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={pending}>
            {config?.cancelText ?? '取消'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className={cn(
              config?.destructive &&
                buttonVariants({ variant: 'destructive' }),
            )}
          >
            {pending ? '处理中…' : config?.confirmText ?? '确认'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
