/** 运行平台类型 */
export type PlatformType = 'chrome-extension' | 'tauri' | 'web';

/** 跨平台存储适配器（实现：Chrome chrome.storage.local / Tauri Store / Web localStorage） */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** 认证适配器（B 站登录窗口管理；Web 端依赖浏览器 cookie，Tauri 端走 Rust 命令） */
export interface AuthAdapter {
  login(): Promise<void>;
  logout(): Promise<void>;
  /** 注册登录成功回调，返回取消订阅函数（调用方负责在卸载时调用以避免泄漏） */
  onLoginSuccess(callback: () => void): () => void;
}

/** QQ 音乐搜索结果 */
export interface QQMusicSong {
  mid: string;
  name: string;
  singer: Array<{ name: string; mid: string }>;
  album: { name: string; mid: string };
}

/** 歌词爬虫适配器（仅桌面端可用） */
export interface SpiderAdapter {
  searchSong(keyword: string, limit?: number): Promise<QQMusicSong[]>;
  getLRC(mid: string): Promise<string>;
}

/**
 * 外链打开适配器
 *
 * - Chrome 扩展 / Web：window.open(url, '_blank', 'noopener,noreferrer')
 * - Tauri：tauri-plugin-shell.open(url) → 调用系统默认浏览器，避免在内嵌 WebView 打开
 *
 * 业务代码应统一通过此接口打开外部链接，禁止直接 window.open。
 */
export interface ShellAdapter {
  openExternal(url: string): Promise<void>;
}

/** 平台桥接接口 */
export interface PlatformBridge {
  type: PlatformType;
  storage: StorageAdapter;
  auth: AuthAdapter;
  shell: ShellAdapter;
  spider?: SpiderAdapter;
  /**
   * 音频 URL 转换器（可选，仅 Tauri 端实现）
   *
   * 用于把原始 B 站 m4s URL 包装为自定义 Tauri scheme（如 bili-stream://），
   * 让 audio 标签的浏览器原生 fetch 走 Rust 后端代理，绕过 Tauri WebView 的
   * Referer 反盗链拦截。Chrome 扩展靠 declarativeNetRequest 改 header，无需此字段。
   *
   * 由 fetchMusicUrl 在返回 URL 前调用：transformer ? transformer(url) : url。
   */
  audioUrlTransformer?: (url: string) => string;
}
