/**
 * G2: TauriAuthAdapter 单测
 *
 * 验证：
 * - login → invoke('bilibili_login')
 * - logout → invoke('bilibili_logout')
 * - onLoginSuccess 注册 listen 监听并把 unlistener 收纳到实例
 * - dispose 调用所有 unlistener
 *
 * Tauri 端会保证：登录 URL 正确、cookie session 剥离、登出后重弹登录。
 * 这些 Rust 行为已由 cargo test 覆盖；前端只验证 invoke 与事件订阅契约。
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
    it('订阅 bilibili:login_success 事件', async () => {
      const unlisten = vi.fn();
      mockListen.mockResolvedValueOnce(unlisten);

      const cb = vi.fn();
      adapter.onLoginSuccess(cb);

      // listen 是 async，等微任务 flush
      await new Promise((r) => setTimeout(r, 0));

      expect(mockListen).toHaveBeenCalledTimes(1);
      expect(mockListen.mock.calls[0][0]).toBe('bilibili:login_success');
    });

    it('事件触发时执行用户回调', async () => {
      const unlisten = vi.fn();
      let registered: ((event: unknown) => void) | undefined;
      mockListen.mockImplementationOnce(async (_name: string, handler: (event: unknown) => void) => {
        registered = handler;
        return unlisten;
      });

      const cb = vi.fn();
      adapter.onLoginSuccess(cb);
      await new Promise((r) => setTimeout(r, 0));

      registered?.({ payload: undefined });
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('多次注册各自独立持有 unlistener', async () => {
      const u1 = vi.fn();
      const u2 = vi.fn();
      mockListen.mockResolvedValueOnce(u1).mockResolvedValueOnce(u2);

      adapter.onLoginSuccess(vi.fn());
      adapter.onLoginSuccess(vi.fn());
      await new Promise((r) => setTimeout(r, 0));

      adapter.dispose();
      expect(u1).toHaveBeenCalledTimes(1);
      expect(u2).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('清空 unlistener 列表，重复 dispose 安全', async () => {
      const unlisten = vi.fn();
      mockListen.mockResolvedValueOnce(unlisten);

      adapter.onLoginSuccess(vi.fn());
      await new Promise((r) => setTimeout(r, 0));

      adapter.dispose();
      adapter.dispose();
      expect(unlisten).toHaveBeenCalledTimes(1);
    });
  });
});
