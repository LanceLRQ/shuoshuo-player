import { usePlayerProfileStore } from '@shuoshuo-player/shared';
import { setCloseAction } from './tauri-window-actions';

/**
 * 把 PlayerProfile.closeAction 同步到 Rust 端 `commands::window::CloseActionState`。
 *
 * Rust 端 `WindowEvent::CloseRequested` handler 据此决定关闭按钮的处置：
 * - 'minimize-to-tray'：拦截关闭事件并隐藏主窗口
 * - 'exit'：放行默认关闭行为，触发应用退出
 *
 * 触发时机：
 * - 启动时（持久化恢复后）调一次，确保 Rust state 与 store 对齐
 * - 用户在设置页 / 首次引导对话框中切换字段时通过 subscribe 自动重发
 *
 * Rust 端在前端尚未同步前默认 'minimize-to-tray'（保守策略，
 * 避免极早期关闭让进程消失，引导对话框丢失）。
 */
export function startCloseActionSync(): void {
  let lastAction = usePlayerProfileStore.getState().closeAction;

  const apply = (): void => {
    void setCloseAction(lastAction).catch((err) => {
      // 单次失败不阻塞应用启动；下次 store 变化会重试
      console.warn('[close-action-sync] set_close_action failed:', err);
    });
  };

  apply();
  usePlayerProfileStore.subscribe((state) => {
    if (state.closeAction === lastAction) return;
    lastAction = state.closeAction;
    apply();
  });
}
