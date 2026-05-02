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
  onLoginSuccess(callback: () => void): void;
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

/** 平台桥接接口 */
export interface PlatformBridge {
  type: PlatformType;
  storage: StorageAdapter;
  auth: AuthAdapter;
  spider?: SpiderAdapter;
}
