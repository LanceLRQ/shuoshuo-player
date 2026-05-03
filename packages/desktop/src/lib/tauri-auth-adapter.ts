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
 * - onLoginSuccess 注册多次时，每次都会拿到一个独立的 unlisten 句柄
 */
export class TauriAuthAdapter implements AuthAdapter {
  private unlisteners: UnlistenFn[] = [];

  async login(): Promise<void> {
    await invoke('bilibili_login');
  }

  async logout(): Promise<void> {
    await invoke('bilibili_logout');
  }

  onLoginSuccess(callback: () => void): void {
    // listen 是异步的，但 AuthAdapter 接口约定同步注册；用 fire-and-forget 模式
    // 把 unlistener 缓存到实例上，便于 dispose() 时清理
    void listen(LOGIN_SUCCESS_EVENT, () => callback()).then((unlisten) => {
      this.unlisteners.push(unlisten);
    });
  }

  /** 释放所有 onLoginSuccess 订阅 */
  dispose(): void {
    this.unlisteners.forEach((u) => u());
    this.unlisteners = [];
  }
}
