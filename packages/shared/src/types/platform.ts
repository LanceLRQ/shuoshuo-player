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

/** 音频缓存统计（与 Rust CacheStats 对齐） */
export interface AudioCacheStats {
  current_bytes: number;
  max_bytes: number;
  entry_count: number;
}

/** 音频缓存管理（仅 Tauri 端实现；用于设置页 PC 缓存 tab） */
export interface AudioCacheAdapter {
  getStats(): Promise<AudioCacheStats>;
  setMaxBytes(bytes: number): Promise<AudioCacheStats>;
  clear(): Promise<void>;
  /** 返回当前生效的缓存目录绝对路径 */
  getDir(): Promise<string>;
  /**
   * 修改缓存目录。null/空 = 恢复默认。立即清空旧目录缓存 + 持久化新路径，
   * **重启应用后新路径生效**。
   */
  setDir(path: string | null): Promise<void>;
  /** 弹 OS 文件夹选择对话框，返回选中绝对路径或 null（用户取消） */
  pickDir(currentPath?: string): Promise<string | null>;
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
  /**
   * 音频缓存管理（可选，仅 Tauri 端实现）
   * 用于设置页 PC 端缓存 Tab 显示用量 / 调整上限 / 一键清空
   */
  audioCache?: AudioCacheAdapter;
}
