/**
 * G1: TauriStorageAdapter 单测
 *
 * 验证：
 * - getItem 拿到 JsonValue 后转字符串（StorageAdapter 接口契约）
 * - setItem 反序列化 JSON 字符串后传 invoke（避免 Rust 端二次解码）
 * - removeItem 走 store_remove
 * - Rust 白名单错误透传到前端 Promise.reject
 */

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { TauriStorageAdapter } from './tauri-storage-adapter';

describe('TauriStorageAdapter', () => {
  let adapter: TauriStorageAdapter;

  beforeEach(() => {
    mockInvoke.mockReset();
    adapter = new TauriStorageAdapter();
  });

  describe('getItem', () => {
    it('返回 null 当 Rust 返回 null', async () => {
      mockInvoke.mockResolvedValueOnce(null);
      expect(await adapter.getItem('player_data')).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith('store_get', { key: 'player_data' });
    });

    it('返回 null 当 Rust 返回 undefined', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      expect(await adapter.getItem('player_data')).toBeNull();
    });

    it('JsonValue 转 JSON 字符串', async () => {
      mockInvoke.mockResolvedValueOnce({ a: 1, b: ['x'] });
      expect(await adapter.getItem('player_data')).toBe('{"a":1,"b":["x"]}');
    });

    it('字符串值原样返回（不再 stringify 加引号）', async () => {
      mockInvoke.mockResolvedValueOnce('https://my.api/v3');
      expect(await adapter.getItem('cloud_api_base_url')).toBe('https://my.api/v3');
    });

    it('白名单错误透传', async () => {
      mockInvoke.mockRejectedValueOnce('Store key not allowed: evil');
      await expect(adapter.getItem('evil')).rejects.toBe('Store key not allowed: evil');
    });
  });

  describe('setItem', () => {
    it('JSON 字符串反序列化后传 invoke', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await adapter.setItem('player_data', JSON.stringify({ ui_profile: { theme: 'dark' } }));
      expect(mockInvoke).toHaveBeenCalledWith('store_set', {
        key: 'player_data',
        value: { ui_profile: { theme: 'dark' } },
      });
    });

    it('非 JSON 文本（如 baseURL 字面量）原样下发', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await adapter.setItem('cloud_api_base_url', 'https://my.api/v3');
      expect(mockInvoke).toHaveBeenCalledWith('store_set', {
        key: 'cloud_api_base_url',
        value: 'https://my.api/v3',
      });
    });

    it('空字符串原样下发', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await adapter.setItem('cloud_api_base_url', '');
      expect(mockInvoke).toHaveBeenCalledWith('store_set', {
        key: 'cloud_api_base_url',
        value: '',
      });
    });

    it('白名单错误透传', async () => {
      mockInvoke.mockRejectedValueOnce('Store key not allowed: system');
      await expect(adapter.setItem('system', '"x"')).rejects.toMatch(/not allowed/);
    });
  });

  describe('removeItem', () => {
    it('调用 store_remove', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await adapter.removeItem('player_data');
      expect(mockInvoke).toHaveBeenCalledWith('store_remove', { key: 'player_data' });
    });

    it('白名单错误透传', async () => {
      mockInvoke.mockRejectedValueOnce('Store key not allowed: evil');
      await expect(adapter.removeItem('evil')).rejects.toMatch(/not allowed/);
    });
  });
});
