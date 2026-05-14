/** 收藏列表类型 */
export enum FavListType {
  CUSTOM = 0,
  UPLOADER = 1,
  BILI_FAV = 2,
}

/** 收藏列表项 */
export interface FavListItem {
  id: string;
  name: string;
  type: FavListType;
  /** type === UPLOADER 时使用：B 站 UP 主 UID（字符串） */
  mid?: string;
  /** type === BILI_FAV 时使用：B 站收藏夹 media_id */
  biliFavFolderId?: string;
  /** type === CUSTOM 时使用：自定义歌单的 BVID 列表 */
  bv_ids: string[];
  create_time: number;
  update_time: number;
}

/** 循环模式 */
export type LoopMode = 'single' | 'loop' | 'random';

/** 悬浮歌词水平对齐 */
export type FloatingLyricsAlign = 'left' | 'center' | 'right';
/** 悬浮歌词字重 */
export type FloatingLyricsWeight = 'normal' | 'bold';
/** 悬浮歌词字体族 */
export type FloatingLyricsFamily = 'sans' | 'serif' | 'mono';
/** 悬浮歌词预设文字色（'' === 'primary'，跟随主色） */
export type FloatingLyricsColor = '' | 'primary' | 'white' | 'black' | 'muted';

/** 悬浮歌词配置（位于 PlayerProfile.floatingLyrics） */
export interface FloatingLyricsConfig {
  /** 是否启用（默认 true） */
  enabled: boolean;
  /** 字号 px，12-32 */
  fontSize: number;
  fontWeight: FloatingLyricsWeight;
  fontFamily: FloatingLyricsFamily;
  textAlign: FloatingLyricsAlign;
  /** 距 footer 顶边的垂直偏移 px，16-64 */
  verticalOffset: number;
  /** 预设色键；'' 视同 'primary' */
  textColor: FloatingLyricsColor;
  /** 背景透明度 0-1 */
  bgOpacity: number;
}

/** 悬浮歌词默认值（首次启动 / 恢复默认时使用） */
export const DEFAULT_FLOATING_LYRICS: FloatingLyricsConfig = {
  enabled: true,
  fontSize: 20,
  fontWeight: 'normal',
  fontFamily: 'sans',
  textAlign: 'center',
  verticalOffset: 16,
  textColor: '',
  bgOpacity: 0.8,
};

/** 播放器全局配置 */
export interface PlayerProfile {
  theme: 'light' | 'dark' | 'auto';
  /** 0 ~ 1 */
  volume: number;
  autoPlay: boolean;
  loopMode: LoopMode;
  /**
   * 强调色（HSL string，如 "221.2 83.2% 53.3%"）。
   * 注入到根级 CSS variable --primary，配合 Tailwind hsl(var(--primary)) 全局生效。
   * 空字符串 / undefined 表示不覆盖（用 globals.css 默认值）。
   */
  primaryColor: string;
  /**
   * 多 P 投稿连续播放（实验性，默认关闭）。
   *
   * 开启后：播放纯 bvid（非显式 :p<n>）TrackId 且为多 P 投稿时，
   * onend 触发会先尝试切到下一 P，直到所有 P 播完才走 next() 切下一个 TrackId。
   *
   * 关闭时：多 P 投稿与单 P 投稿表现一致——一首结束即切下一首。
   */
  autoPlayNextPage: boolean;
  /** 悬浮歌词（footer 上方歌词条）的样式与开关 */
  floatingLyrics: FloatingLyricsConfig;
  /** 主窗口关闭按钮的处置方式（仅 Tauri 桌面端生效） */
  closeAction: CloseAction;
  /**
   * 是否已经向用户展示过"关闭行为"首次引导对话框。
   * 仅 Tauri 平台读取；老用户升级缺该字段时视为 false，下次启动会弹一次引导。
   */
  closeActionFirstRunPrompted: boolean;
}

/** 默认强调色（与 packages/web/src/styles/globals.css 中 --primary 一致；#FF6687 中粉） */
export const DEFAULT_PRIMARY_COLOR = '347 100% 70%';

/**
 * 主窗口关闭按钮的处置方式（仅 Tauri 桌面端生效）：
 * - 'exit'：关闭窗口即退出整个应用进程（v1 行为）
 * - 'minimize-to-tray'：拦截关闭事件，仅隐藏窗口到系统托盘 / 菜单栏；
 *   退出由托盘菜单"退出"或 macOS Dock 右键 Quit 触发
 *
 * Web/Chrome 扩展平台忽略此字段（其后台播放生命周期由 tab 自身决定）。
 */
export type CloseAction = 'exit' | 'minimize-to-tray';

/**
 * 默认行为：隐藏到托盘
 *
 * 选这个是为了配合首次启动的引导对话框——Modal 阻塞 UI 强制用户二选一前的兜底；
 * 万一用户绕过 Modal 关掉窗口，"隐藏"比"退出"更安全（托盘还能恢复，不会让进程消失导致用户找不到引导）。
 */
export const DEFAULT_CLOSE_ACTION: CloseAction = 'minimize-to-tray';
