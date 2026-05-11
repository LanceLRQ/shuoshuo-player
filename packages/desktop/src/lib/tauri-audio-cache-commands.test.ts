const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { getCacheStats, setCacheMaxBytes, clearCache } from './tauri-audio-cache-commands';

describe('tauri-audio-cache-commands', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('getCacheStats 调用对应 Rust command', async () => {
    mockInvoke.mockResolvedValueOnce({
      current_bytes: 12345,
      max_bytes: 1073741824,
      entry_count: 7,
    });
    const stats = await getCacheStats();
    expect(mockInvoke).toHaveBeenCalledWith('get_cache_stats');
    expect(stats).toEqual({ current_bytes: 12345, max_bytes: 1073741824, entry_count: 7 });
  });

  it('setCacheMaxBytes 传递 bytes 参数', async () => {
    mockInvoke.mockResolvedValueOnce({
      current_bytes: 0,
      max_bytes: 524288000,
      entry_count: 0,
    });
    const stats = await setCacheMaxBytes(524288000);
    expect(mockInvoke).toHaveBeenCalledWith('set_cache_max_bytes', { bytes: 524288000 });
    expect(stats.max_bytes).toBe(524288000);
  });

  it('clearCache 无返回值', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await clearCache();
    expect(mockInvoke).toHaveBeenCalledWith('clear_cache');
  });

  it('Rust 错误透传到 Promise.reject', async () => {
    mockInvoke.mockRejectedValueOnce('current_bytes poisoned');
    await expect(getCacheStats()).rejects.toBe('current_bytes poisoned');
  });
});
