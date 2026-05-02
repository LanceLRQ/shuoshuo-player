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
}
