import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { HttpAdapter } from '@shuoshuo-player/shared';

/**
 * Tauri 端通用 HttpAdapter
 *
 * 走 @tauri-apps/plugin-http 的 fetch（底层 reqwest）以绕过 Tauri WebView 的 CORS 限制。
 * 当前仅用于更新检查（download.hutao.wiki + api.github.com）。
 *
 * 受 packages/desktop/src-tauri/capabilities/default.json 中 http:default
 * scope 白名单约束——未列入的 URL 会被 Tauri 拒绝调用。
 */
export class TauriHttpAdapter implements HttpAdapter {
  async getJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const res = await tauriFetch(url, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json();
  }
}
