import { invoke } from '@tauri-apps/api/core';
import type { StorageAdapter } from '@shuoshuo-player/shared';

/**
 * Tauri Store 适配器
 *
 * 与 Rust commands/store.rs 一一对应：
 * - getItem → invoke('store_get', { key })
 * - setItem → invoke('store_set', { key, value })
 * - removeItem → invoke('store_remove', { key })
 *
 * StorageAdapter 接口要求 string 进 string 出，Tauri 端保留 JSON 结构以减少
 * 跨进程序列化损耗：
 * - setItem 接收前端 JSON.stringify 后的字符串，本类 JSON.parse 还原对象传给 Rust
 * - getItem 拿到 Rust 返回的 JsonValue，再 JSON.stringify 给前端
 *
 * 仅 ["player_data", "cloud_api_base_url"] 在 Rust 白名单内，其他 key 会被拒绝。
 */
export class TauriStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const value = await invoke<unknown>('store_get', { key });
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  async setItem(key: string, value: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      // 非 JSON 字符串原样下发（如自定义 baseURL 文本）
      parsed = value;
    }
    await invoke('store_set', { key, value: parsed });
  }

  async removeItem(key: string): Promise<void> {
    await invoke('store_remove', { key });
  }
}
