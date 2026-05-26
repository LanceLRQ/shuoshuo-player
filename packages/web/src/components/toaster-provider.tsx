import { useEffect, type CSSProperties } from 'react';
import { Toaster, toast } from 'sonner';
import {
  useUIStore,
  NoticeType,
  usePlayerProfileStore,
  type NoticeAction,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';

/** 把多操作按钮渲染成 sonner action 可接收的 ReactNode（首项主按钮，其余次按钮） */
function renderActions(actions: NoticeAction[]) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onClick}
          className={cn(
            'h-7 shrink-0 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors',
            i === 0
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {a.label}
        </button>
      ))}
    </span>
  );
}

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
    // 预热已存在 notice，避免 StrictMode 双挂载或初始 state 非空时重复弹
    for (const n of useUIStore.getState().notices) seen.add(n.id);
    const removeNotice = useUIStore.getState().removeNotice;
    const unsub = useUIStore.subscribe((state, prev) => {
      // useUIStore 当前只有 notices 字段；保留引用相等短路便于未来加字段后不被无关变化触发
      if (state.notices === prev.notices) return;
      const currentIds = new Set(state.notices.map((n) => n.id));
      for (const n of prev.notices) {
        if (!currentIds.has(n.id)) {
          toast.dismiss(n.id);
          seen.delete(n.id);
        }
      }

      for (const notice of state.notices) {
        if (seen.has(notice.id)) continue;
        // sonner 关闭即回写 store removeNotice，覆盖 onAutoClose（duration 到期）与 onDismiss
        // （手动关闭 / toast.dismiss 程控）；duration=Infinity 不触发 onAutoClose（常驻语义保持）
        // removeNotice 是 filter 实现，多路径同 id 重复调用幂等
        const cleanup = () => removeNotice(notice.id);
        // 多按钮（notice.actions）优先：渲染成自定义 ReactNode；否则回退单 action 对象
        const action =
          notice.actions && notice.actions.length > 0
            ? renderActions(notice.actions)
            : notice.action
              ? { label: notice.action.label, onClick: notice.action.onClick }
              : undefined;
        const opts: Parameters<typeof toast>[1] = {
          id: notice.id,
          duration: notice.duration === null ? Infinity : notice.duration,
          action,
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

  // 略加宽至 400px：双按钮更新提示在默认 356px 下会把按钮挤换行；
  // 文案过长时让其自然换行，按钮已 whitespace-nowrap 不受影响
  return (
    <Toaster
      richColors
      position="top-center"
      theme={theme}
      closeButton
      expand
      style={{ '--width': '400px' } as CSSProperties}
    />
  );
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
