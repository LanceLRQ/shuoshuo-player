import type { StorageAdapter } from '@shuoshuo-player/shared';

/**
 * Web 开发环境存储适配器（localStorage 同步 API → Promise 包装）
 * 仅用于 vite dev / 浏览器直接访问，扩展环境优先 ChromeStorageAdapter
 */
export class LocalStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
