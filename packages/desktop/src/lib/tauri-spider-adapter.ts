import { invoke } from '@tauri-apps/api/core';
import type { QQMusicSong, SpiderAdapter } from '@shuoshuo-player/shared';

/**
 * Tauri 端歌词爬虫适配器
 *
 * 与 Rust commands::spider 一一对应：
 * - searchSong → invoke('qqmusic_search', { keyword, limit })
 * - getLRC → invoke('qqmusic_get_lrc', { mid })
 *
 * Rust 端负责：JSONP 剥离、Base64 解码、反爬 Header 注入；前端只透传调用。
 * Chrome 扩展端不实现 SpiderAdapter（PlatformBridge.spider 为 undefined），
 * 调用方使用前需检查 bridge.spider 是否存在。
 */
export class TauriSpiderAdapter implements SpiderAdapter {
  async searchSong(keyword: string, limit?: number): Promise<QQMusicSong[]> {
    return invoke<QQMusicSong[]>('qqmusic_search', { keyword, limit });
  }

  async getLRC(mid: string): Promise<string> {
    return invoke<string>('qqmusic_get_lrc', { mid });
  }
}
