import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useUIStore, NoticeType, usePlayerProfileStore } from '@shuoshuo-player/shared';

/**
 * sonner 全局 Provider + 桥接 useUIStore.notices。
 *
 * 行为：
 * - 订阅 useUIStore.notices 变化，根据 type 派发对应 toast
 * - 同 id 的通知自动复用 sonner 的 update（通过 toast.message id 选项）
 * - duration === null 视为不自动关闭
 */
export function ToasterProvider() {
  const theme = usePlayerProfileStore((s) => s.getEffectiveTheme());

  useEffect(() => {
    const seen = new Set<string>();
    const unsub = useUIStore.subscribe((state, prev) => {
      const removed = prev.notices.filter((n) => !state.notices.find((x) => x.id === n.id));
      removed.forEach((n) => {
        toast.dismiss(n.id);
        seen.delete(n.id);
      });

      for (const notice of state.notices) {
        const opts: Parameters<typeof toast>[1] = {
          id: notice.id,
          duration: notice.duration === null ? Infinity : notice.duration,
          action: notice.action
            ? { label: notice.action.label, onClick: notice.action.onClick }
            : undefined,
          dismissible: notice.close,
        };
        switch (notice.type) {
          case NoticeType.SUCCESS:
            toast.success(notice.message, opts);
            break;
          case NoticeType.WARN:
            toast.warning(notice.message, opts);
            break;
          case NoticeType.ERROR:
            toast.error(notice.message, opts);
            break;
          default:
            toast.info(notice.message, opts);
        }
        seen.add(notice.id);
      }
    });
    return () => unsub();
  }, []);

  return <Toaster richColors position="top-center" theme={theme} closeButton expand />;
}

/**
 * 便利 Hook：直接 push 到 useUIStore，由上方 Provider 桥接到 sonner。
 * 业务代码可只 import useNotice() 使用。
 */
export function useNotice() {
  const sendNotice = useUIStore((s) => s.sendNotice);
  return {
    info: (message: string, opts?: { id?: string; duration?: number | null }) =>
      sendNotice({ ...opts, type: NoticeType.INFO, message }),
    success: (message: string, opts?: { id?: string; duration?: number | null }) =>
      sendNotice({ ...opts, type: NoticeType.SUCCESS, message }),
    warning: (message: string, opts?: { id?: string; duration?: number | null }) =>
      sendNotice({ ...opts, type: NoticeType.WARN, message }),
    error: (message: string, opts?: { id?: string; duration?: number | null }) =>
      sendNotice({ ...opts, type: NoticeType.ERROR, message }),
  };
}
