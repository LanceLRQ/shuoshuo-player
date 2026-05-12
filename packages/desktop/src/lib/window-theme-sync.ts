import { invoke } from '@tauri-apps/api/core';
import { usePlayerProfileStore } from '@shuoshuo-player/shared';

/**
 * 同步应用 PlayerProfile.theme 到 Tauri 原生窗口外观（NSWindow.appearance / Windows immersive）。
 *
 * 必要性：Tauri v2 的 webview `setTheme()` 在 macOS 上是 NOOP，仅影响 webview
 * 的 prefers-color-scheme，**不会改变 macOS 系统标题栏文字颜色**。在
 * `titleBarStyle: "Overlay"` 模式下，标题文字色会变得与 shell 背景极难分辨。
 * 必须走 Rust 端的 `Window::set_theme()` 调用 NSWindow API 才能生效。
 *
 * 触发：
 * - 启动时一次（与持久化恢复后的 theme 对齐）
 * - PlayerProfile.theme 变化时（设置 → 外观切换）
 *
 * theme=auto → 传 null 让 Tauri 跟随系统偏好；setTheme 调用幂等。
 */
export function startWindowThemeSync(): void {
  let lastTheme: 'light' | 'dark' | 'auto' | null = null;

  const apply = (): void => {
    const theme = usePlayerProfileStore.getState().theme;
    if (theme === lastTheme) return;
    lastTheme = theme;
    const payload = theme === 'auto' ? null : theme;
    void invoke('set_window_theme', { theme: payload }).catch((err) => {
      // 单次失败不阻塞应用启动；记录便于排查
      console.warn('[window-theme-sync] set_window_theme failed:', err);
    });
  };

  apply();
  usePlayerProfileStore.subscribe(apply);
}
