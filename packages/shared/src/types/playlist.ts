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
}

/** 默认强调色（与 packages/web/src/styles/globals.css 中 --primary 一致；#FF6687 中粉） */
export const DEFAULT_PRIMARY_COLOR = '347 100% 70%';
