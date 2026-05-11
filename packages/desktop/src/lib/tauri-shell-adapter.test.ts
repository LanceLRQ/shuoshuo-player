/**
 * TauriShellAdapter 单测
 *
 * 验证 plugin-shell::open 调用契约（与 Rust 端 capability 配置 shell:allow-open 配合）
 */

const mockOpen = vi.fn();
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

import { TauriShellAdapter } from './tauri-shell-adapter';

describe('TauriShellAdapter', () => {
  let adapter: TauriShellAdapter;

  beforeEach(() => {
    mockOpen.mockReset();
    adapter = new TauriShellAdapter();
  });

  it('openExternal 调用 plugin-shell::open(url)', async () => {
    mockOpen.mockResolvedValueOnce(undefined);
    await adapter.openExternal('https://www.bilibili.com/video/BV1');
    expect(mockOpen).toHaveBeenCalledWith('https://www.bilibili.com/video/BV1');
  });

  it('空字符串静默返回，不调用 plugin', async () => {
    await adapter.openExternal('');
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('plugin 抛错时透传到 Promise.reject（capability 配错时及早暴露）', async () => {
    mockOpen.mockRejectedValueOnce('shell.open not allowed');
    await expect(adapter.openExternal('https://x.com')).rejects.toMatch(/not allowed/);
  });
});
