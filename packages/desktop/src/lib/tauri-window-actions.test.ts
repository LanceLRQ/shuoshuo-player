const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { setCloseAction } from './tauri-window-actions';

describe('tauri-window-actions', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('setCloseAction 传递 minimize-to-tray', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await setCloseAction('minimize-to-tray');
    expect(mockInvoke).toHaveBeenCalledWith('set_close_action', { action: 'minimize-to-tray' });
  });

  it('setCloseAction 传递 exit', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await setCloseAction('exit');
    expect(mockInvoke).toHaveBeenCalledWith('set_close_action', { action: 'exit' });
  });

  it('Rust 错误透传到 Promise.reject', async () => {
    mockInvoke.mockRejectedValueOnce('invalid close action');
    await expect(setCloseAction('exit')).rejects.toBe('invalid close action');
  });
});
