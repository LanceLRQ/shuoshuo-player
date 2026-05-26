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

/**
 * 默认音频音质偏好：
 * - 'auto'：账号权限内最高可用（大会员可达 Hi-Res / 杜比，普通用户落到 192K）
 * - 'hires' / 'dolby'：大会员专属，无权限或视频无该流时自动降级到常规音质
 * - 'high' / 'medium' / 'low'：常规 192K / 132K / 64K
 */
export type AudioQualityPreference = 'auto' | 'hires' | 'dolby' | 'high' | 'medium' | 'low';

/** 默认音质偏好：自动取最高可用 */
export const DEFAULT_AUDIO_QUALITY: AudioQualityPreference = 'auto';

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
  /**
   * 「以合集为歌单播放」时的队列行为：
   * - 'replace'：替换当前播放队列（默认，符合"现在听这个合集"的直觉）
   * - 'append'：追加到当前队列尾部，首条立即播放
   *
   * 与播放器循环模式、单条点击行为正交，仅作用于合集详情顶部"以合集为歌单播放"按钮。
   */
  collectionPlayBehavior: CollectionPlayBehavior;
  /** 首页「最新投稿」列表的展示模式；老用户缺该字段时 fallback DEFAULT_HOME_VIEW_MODE */
  homeViewMode: VideoListViewMode;
  /** 歌单页列表的展示模式（所有歌单共享一个偏好）；fallback DEFAULT_FAV_VIEW_MODE */
  favViewMode: VideoListViewMode;
  /**
   * 默认音频音质偏好。取流时按此选流，账号无权限 / 视频无该流时自动降级到可播放音质。
   * 仅影响下次切歌 / 切 P（不打断当前播放）。老用户缺该字段时 fallback DEFAULT_AUDIO_QUALITY。
   */
  defaultAudioQuality: AudioQualityPreference;
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

/**
 * 合集播放行为：
 * - 'replace'：「以合集为歌单播放」按钮按下后替换当前播放队列
 * - 'append'：合集追加到队列尾，首条立即播放
 */
export type CollectionPlayBehavior = 'replace' | 'append';

/** 默认：替换当前队列。符合"现在听这个合集"的直觉用法 */
export const DEFAULT_COLLECTION_PLAY_BEHAVIOR: CollectionPlayBehavior = 'replace';

/** 视频列表展示模式：'list' 单行列表 / 'thumbnail' 3:2 封面网格 */
export type VideoListViewMode = 'list' | 'thumbnail';

/** 首页默认缩略图（封面优先，符合"浏览最新投稿"的直觉） */
export const DEFAULT_HOME_VIEW_MODE: VideoListViewMode = 'thumbnail';

/** 歌单默认列表（信息密度优先，符合"管理 / 检索歌曲"的场景） */
export const DEFAULT_FAV_VIEW_MODE: VideoListViewMode = 'list';
