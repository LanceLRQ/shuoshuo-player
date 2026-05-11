/// <reference types="chrome" />
import type { StorageAdapter } from '@shuoshuo-player/shared';

/**
 * Chrome 扩展存储适配器（chrome.storage.local）
 * MV3 service worker 重启后该存储仍可访问，是首选持久化方案
 */
export class ChromeStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get([key]);
    const value = result[key];
    return typeof value === 'string' ? value : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
