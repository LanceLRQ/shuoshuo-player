/**
 * startWindowThemeSync 单测
 *
 * 验证：应用主题 → Tauri invoke('set_window_theme') 的同步契约。
 * 实际 NSWindow.appearance 切换由 Rust 端 cargo + macOS runtime 行为承担。
 */

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { usePlayerProfileStore } from '@shuoshuo-player/shared';
import { startWindowThemeSync } from './window-theme-sync';

describe('startWindowThemeSync', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    usePlayerProfileStore.setState({ theme: 'auto' });
  });

  it('启动时立即同步当前 theme（auto → null）', () => {
    startWindowThemeSync();
    expect(mockInvoke).toHaveBeenCalledWith('set_window_theme', { theme: null });
  });

  it('启动时若 theme=light，传 "light"', () => {
    usePlayerProfileStore.setState({ theme: 'light' });
    startWindowThemeSync();
    expect(mockInvoke).toHaveBeenCalledWith('set_window_theme', { theme: 'light' });
  });

  it('启动时若 theme=dark，传 "dark"', () => {
    usePlayerProfileStore.setState({ theme: 'dark' });
    startWindowThemeSync();
    expect(mockInvoke).toHaveBeenCalledWith('set_window_theme', { theme: 'dark' });
  });

  it('订阅 store：theme 变化时再次 invoke', () => {
    startWindowThemeSync();
    mockInvoke.mockClear();
    usePlayerProfileStore.setState({ theme: 'dark' });
    expect(mockInvoke).toHaveBeenCalledWith('set_window_theme', { theme: 'dark' });
  });

  it('订阅 store：theme 未变（无关字段更新）不重复 invoke', () => {
    usePlayerProfileStore.setState({ theme: 'light' });
    startWindowThemeSync();
    mockInvoke.mockClear();
    // 改一个无关字段
    usePlayerProfileStore.setState({ volume: 0.5 });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('invoke 失败时仅 console.warn，不抛错', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('boom'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => startWindowThemeSync()).not.toThrow();
      // 等待 microtask 让 Promise rejection 走完 .catch
      await Promise.resolve();
      await Promise.resolve();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
