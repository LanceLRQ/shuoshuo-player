const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { startCloseActionSync } from './close-action-sync';
import { usePlayerProfileStore } from '@shuoshuo-player/shared';

describe('close-action-sync', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    usePlayerProfileStore.setState({ closeAction: 'minimize-to-tray' });
  });

  it('启动时根据当前 store 值发一次 invoke', async () => {
    startCloseActionSync();
    // microtask 让 invoke 落到 mock 上
    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledWith('set_close_action', {
      action: 'minimize-to-tray',
    });
  });

  it('store.closeAction 变化时重发 invoke', async () => {
    startCloseActionSync();
    await Promise.resolve();
    mockInvoke.mockClear();

    usePlayerProfileStore.setState({ closeAction: 'exit' });
    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledWith('set_close_action', { action: 'exit' });
  });

  it('store 其他字段变化不会触发 invoke', async () => {
    startCloseActionSync();
    await Promise.resolve();
    mockInvoke.mockClear();

    usePlayerProfileStore.setState({ volume: 0.5 });
    await Promise.resolve();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('invoke 失败时不抛错（仅 console.warn）', async () => {
    mockInvoke.mockRejectedValueOnce('Rust 端命令未注册');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => startCloseActionSync()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
