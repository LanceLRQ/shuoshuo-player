/**
 * TauriSpiderAdapter 单测
 *
 * 验证 invoke 调用契约（Rust 行为已由 cargo test 覆盖）
 */

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { TauriSpiderAdapter } from './tauri-spider-adapter';

describe('TauriSpiderAdapter', () => {
  let adapter: TauriSpiderAdapter;

  beforeEach(() => {
    mockInvoke.mockReset();
    adapter = new TauriSpiderAdapter();
  });

  describe('searchSong', () => {
    it('调用 qqmusic_search 命令并透传 keyword/limit', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      await adapter.searchSong('hello', 25);
      expect(mockInvoke).toHaveBeenCalledWith('qqmusic_search', {
        keyword: 'hello',
        limit: 25,
      });
    });

    it('未传 limit 时也调用（由 Rust 端默认 10）', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      await adapter.searchSong('world');
      expect(mockInvoke).toHaveBeenCalledWith('qqmusic_search', {
        keyword: 'world',
        limit: undefined,
      });
    });

    it('返回 Rust 反序列化后的歌曲数组', async () => {
      const songs = [
        { mid: 'm1', name: 'Song 1', singer: [{ name: 'A', mid: 'a' }], album: { name: 'X', mid: 'x' } },
      ];
      mockInvoke.mockResolvedValueOnce(songs);
      expect(await adapter.searchSong('x')).toEqual(songs);
    });

    it('Rust 错误透传到 Promise.reject', async () => {
      mockInvoke.mockRejectedValueOnce('Failed to parse search results');
      await expect(adapter.searchSong('x')).rejects.toMatch(/parse/);
    });
  });

  describe('getLRC', () => {
    it('调用 qqmusic_get_lrc 命令', async () => {
      mockInvoke.mockResolvedValueOnce('[00:00.00]Test');
      await adapter.getLRC('mid-1');
      expect(mockInvoke).toHaveBeenCalledWith('qqmusic_get_lrc', { mid: 'mid-1' });
    });

    it('返回 Rust 解码后的 LRC 文本', async () => {
      mockInvoke.mockResolvedValueOnce('[00:01]Hello');
      expect(await adapter.getLRC('m')).toBe('[00:01]Hello');
    });

    it('Rust JSONP 解析错误透传', async () => {
      mockInvoke.mockRejectedValueOnce('Failed to parse JSONP response');
      await expect(adapter.getLRC('m')).rejects.toMatch(/JSONP/);
    });
  });
});
