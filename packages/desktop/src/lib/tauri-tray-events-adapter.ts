import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { TrayEventsAdapter } from '@shuoshuo-player/shared';

/**
 * Tauri 端托盘事件适配器
 *
 * 让 web 包内的组件（在 React 路由上下文里）订阅 Rust emit 的菜单事件，
 * 与 TauriAuthAdapter.onLoginSuccess 一致的"同步返回 unsubscribe / 内部 await 注册"模式。
 */
export class TauriTrayEventsAdapter implements TrayEventsAdapter {
  onOpenSettings(callback: () => void): () => void {
    let cancelled = false;
    const registerPromise: Promise<UnlistenFn> = listen('tray:open-settings', () => callback());

    return () => {
      if (cancelled) return;
      cancelled = true;
      void registerPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }
}
