import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AuthAdapter } from '@shuoshuo-player/shared';

const LOGIN_SUCCESS_EVENT = 'bilibili:login_success';

/**
 * Tauri 端 B 站登录适配器
 *
 * 与 Rust commands::auth 一一对应：
 * - login → invoke('bilibili_login')：打开登录窗口（已存在则 set_focus）
 * - logout → invoke('bilibili_logout')：清空 cookies + 重弹登录窗口
 * - onLoginSuccess → 订阅 'bilibili:login_success' Tauri 事件
 *
 * 关键不变量：
 * - 登录 URL（passport.bilibili.com/pc/passport/login）由 Rust 端控制，前端无法覆盖
 * - onLoginSuccess 同步返回 unsubscribe 函数；底层 listen 是异步的，
 *   unsubscribe 内部 await 注册 Promise 后再调 unlisten，避免取消时机早于注册完成的竞态
 */
export class TauriAuthAdapter implements AuthAdapter {
  async login(): Promise<void> {
    await invoke('bilibili_login');
  }

  async logout(): Promise<void> {
    await invoke('bilibili_logout');
  }

  onLoginSuccess(callback: () => void): () => void {
    let cancelled = false;
    const registerPromise: Promise<UnlistenFn> = listen(LOGIN_SUCCESS_EVENT, () => callback());

    return () => {
      if (cancelled) return;
      cancelled = true;
      void registerPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }
}
