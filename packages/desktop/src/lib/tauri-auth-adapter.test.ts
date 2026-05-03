/**
 * G2: TauriAuthAdapter 单测
 *
 * 验证：
 * - login → invoke('bilibili_login')
 * - logout → invoke('bilibili_logout')
 * - onLoginSuccess 同步返回 unsubscribe，事件触发执行回调
 * - unsubscribe 等待异步注册完成后调 unlisten（避免取消时机早于注册的竞态）
 */

const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

import { TauriAuthAdapter } from './tauri-auth-adapter';

describe('TauriAuthAdapter', () => {
  let adapter: TauriAuthAdapter;

  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    adapter = new TauriAuthAdapter();
  });

  describe('login', () => {
    it('调用 bilibili_login 命令', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await adapter.login();
      expect(mockInvoke).toHaveBeenCalledWith('bilibili_login');
    });

    it('Rust 端错误透传到 Promise.reject', async () => {
      mockInvoke.mockRejectedValueOnce('webview build failed');
      await expect(adapter.login()).rejects.toBe('webview build failed');
    });
  });

  describe('logout', () => {
    it('调用 bilibili_logout 命令', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await adapter.logout();
      expect(mockInvoke).toHaveBeenCalledWith('bilibili_logout');
    });
  });

  describe('onLoginSuccess', () => {
    it('订阅 bilibili:login_success 事件', () => {
      mockListen.mockResolvedValueOnce(vi.fn());

      adapter.onLoginSuccess(vi.fn());

      expect(mockListen).toHaveBeenCalledTimes(1);
      expect(mockListen.mock.calls[0][0]).toBe('bilibili:login_success');
    });

    it('事件触发时执行用户回调', async () => {
      const unlisten = vi.fn();
      let registered: ((event: unknown) => void) | undefined;
      mockListen.mockImplementationOnce(
        async (_name: string, handler: (event: unknown) => void) => {
          registered = handler;
          return unlisten;
        },
      );

      const cb = vi.fn();
      adapter.onLoginSuccess(cb);
      await new Promise((r) => setTimeout(r, 0));

      registered?.({ payload: undefined });
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('返回的 unsubscribe 等待 listen 完成后调 unlisten', async () => {
      const unlisten = vi.fn();
      mockListen.mockResolvedValueOnce(unlisten);

      const unsubscribe = adapter.onLoginSuccess(vi.fn());
      // 异步注册尚未 resolve 时取消
      unsubscribe();
      await new Promise((r) => setTimeout(r, 0));

      expect(unlisten).toHaveBeenCalledTimes(1);
    });

    it('多次 unsubscribe 幂等', async () => {
      const unlisten = vi.fn();
      mockListen.mockResolvedValueOnce(unlisten);

      const unsubscribe = adapter.onLoginSuccess(vi.fn());
      await new Promise((r) => setTimeout(r, 0));

      unsubscribe();
      unsubscribe();
      // 等待 registerPromise.then(unlisten()) 这条 microtask 链 flush
      await new Promise((r) => setTimeout(r, 0));
      expect(unlisten).toHaveBeenCalledTimes(1);
    });

    it('多次注册各自独立', async () => {
      const u1 = vi.fn();
      const u2 = vi.fn();
      mockListen.mockResolvedValueOnce(u1).mockResolvedValueOnce(u2);

      const cancel1 = adapter.onLoginSuccess(vi.fn());
      const cancel2 = adapter.onLoginSuccess(vi.fn());
      await new Promise((r) => setTimeout(r, 0));

      cancel1();
      cancel2();
      await new Promise((r) => setTimeout(r, 0));
      expect(u1).toHaveBeenCalledTimes(1);
      expect(u2).toHaveBeenCalledTimes(1);
    });
  });
});
