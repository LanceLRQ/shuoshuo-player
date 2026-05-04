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
    // 把订阅前已存在的 notice 标记为已处理，避免 StrictMode 双挂载或初始 state 非空时重复弹
    for (const n of useUIStore.getState().notices) seen.add(n.id);
    const unsub = useUIStore.subscribe((state, prev) => {
      const removed = prev.notices.filter((n) => !state.notices.find((x) => x.id === n.id));
      removed.forEach((n) => {
        toast.dismiss(n.id);
        seen.delete(n.id);
      });

      for (const notice of state.notices) {
        // sendNotice 只 push 不 remove，notices 单调增长；不跳过已处理 id 会让后续每次新通知都重弹历史项
        if (seen.has(notice.id)) continue;
        // sonner 关闭后回写 store removeNotice，避免 notices 数组永久累积
        // - onAutoClose: duration 到期时触发；duration=Infinity 时不会触发（常驻 tip 保持）
        // - onDismiss: toast.delete=true 时触发，覆盖用户手动关闭和 toast.dismiss(id) 程控关闭
        // 两者都可能因不同关闭路径触发；removeNotice 是 filter 实现，重复调用幂等
        const cleanup = () => useUIStore.getState().removeNotice(notice.id);
        const opts: Parameters<typeof toast>[1] = {
          id: notice.id,
          duration: notice.duration === null ? Infinity : notice.duration,
          action: notice.action
            ? { label: notice.action.label, onClick: notice.action.onClick }
            : undefined,
          dismissible: notice.close,
          onAutoClose: cleanup,
          onDismiss: cleanup,
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
