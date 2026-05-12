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
}

/** 默认强调色（与 packages/web/src/styles/globals.css 中 --primary 一致；#FF8FA7 中粉） */
export const DEFAULT_PRIMARY_COLOR = '347 100% 78%';
