import type { PlatformBridge } from '@shuoshuo-player/shared';
import { TauriStorageAdapter } from './tauri-storage-adapter';
import { TauriAuthAdapter } from './tauri-auth-adapter';
import { TauriSpiderAdapter } from './tauri-spider-adapter';
import { TauriShellAdapter } from './tauri-shell-adapter';
import { transformBilibiliAudioUrl } from './tauri-audio-url-transformer';

/**
 * 创建 Tauri 桌面端 PlatformBridge
 *
 * 与 Chrome 扩展端的差异：
 * - storage：Tauri Store（白名单 + 文件持久化），非 chrome.storage.local
 * - auth：Tauri 命令打开登录窗口 + 监听 Tauri event，非 window.open + cookie 自动鉴权
 * - shell：plugin-shell::open 让系统浏览器打开外链，非 WebView 内嵌
 * - spider：Chrome 扩展端为空（CORS 限制）；桌面端通过 Rust 命令绕过 CORS
 */
export function createTauriPlatformBridge(): PlatformBridge {
  return {
    type: 'tauri',
    storage: new TauriStorageAdapter(),
    auth: new TauriAuthAdapter(),
    shell: new TauriShellAdapter(),
    spider: new TauriSpiderAdapter(),
    // audio 标签的浏览器原生 fetch 无法被 axios adapter 拦截；改 URL 让其走
    // Rust 端 bili-stream:// custom protocol 代理（注入 Cookie/Origin/Referer/UA）
    audioUrlTransformer: transformBilibiliAudioUrl,
  };
}
