/**
 * 11 个持久化 store 的"对外快照形状"统一定义
 *
 * 与 store 内部 State 的差异：
 * - 仅声明会被写入 player_data 的字段（去掉 actions、瞬态字段）
 * - 全部字段可选，反序列化路径需对缺失字段兜底
 *
 * 写入侧由 STORE_PERSIST_REGISTRY.snapshot 保证形状，恢复侧由
 * STORE_PERSIST_REGISTRY.hydrate 收窄并落 setState。
 */
import type {
  BilibiliSpaceInfo,
  BilibiliVideo,
  CloseAction,
  CloudServiceSession,
  CollectionPlayBehavior,
  FavFolderCacheEntry,
  FavListItem,
  FloatingLyricsConfig,
  LoopMode,
  LyricEntry,
  VideoListCacheEntry,
  VideoListViewMode,
} from '../types';
import type { MusicUrlCacheEntry } from './music-url-cache';
import type { UpdateInfo } from '../api/update';

export interface PersistedBilibiliVideosShape {
  ids?: string[];
  entities?: Record<string, BilibiliVideo>;
}

export interface PersistedBilibiliUserVideosShape {
  isLoading?: boolean;
  infos?: Record<string, VideoListCacheEntry>;
  space?: Record<string, BilibiliSpaceInfo>;
  favFolders?: Record<string, FavFolderCacheEntry>;
}

export interface PersistedPlayingListShape {
  favId?: string;
  /** 当前字段；旧版本（A 系列前）使用 bvIds，hydrate 时兼容读取 */
  trackIds?: string[];
  /** @deprecated 仅用于 hydrate 兼容，新代码不要写入 */
  bvIds?: string[];
  current?: string;
}

export interface PersistedFavListShape {
  list?: FavListItem[];
}

export interface PersistedPlayerProfileShape {
  theme?: 'light' | 'dark' | 'auto';
  volume?: number;
  autoPlay?: boolean;
  loopMode?: LoopMode;
  /** HSL 主色字符串（如 "221.2 83.2% 53.3%"），与 globals.css --primary 同语义 */
  primaryColor?: string;
  /** 多 P 投稿自动连续播放（B4 起，默认 false） */
  autoPlayNextPage?: boolean;
  /**
   * 悬浮歌词配置；老用户无此字段，hydrate 必须 spread DEFAULT_FLOATING_LYRICS 兜底。
   * 字段级 partial：从老版本升级或外部 import 可能只带部分键。
   */
  floatingLyrics?: Partial<FloatingLyricsConfig>;
  /** 主窗口关闭按钮处置方式（仅 Tauri 桌面端生效） */
  closeAction?: CloseAction;
  /** 是否已展示过首次引导对话框（仅 Tauri 平台读取） */
  closeActionFirstRunPrompted?: boolean;
  /** 「以合集为歌单播放」按钮的队列行为；老用户缺该字段时 fallback DEFAULT_COLLECTION_PLAY_BEHAVIOR */
  collectionPlayBehavior?: CollectionPlayBehavior;
  /** 首页列表展示模式；老用户缺该字段时 hydrate fallback DEFAULT_HOME_VIEW_MODE */
  homeViewMode?: VideoListViewMode;
  /** 歌单列表展示模式；fallback DEFAULT_FAV_VIEW_MODE */
  favViewMode?: VideoListViewMode;
}

export interface PersistedLyricsShape {
  lyricMaps?: Record<string, LyricEntry>;
}

export interface PersistedCloudServiceShape {
  session?: CloudServiceSession;
}

export interface PersistedMusicUrlCacheShape {
  entries?: Record<string, MusicUrlCacheEntry>;
}

export interface PersistedUpdateCheckerShape {
  /** ISO 时间戳，节流判断用 */
  lastCheckedAt?: string | null;
  /** 最近一次成功拉到的版本信息 */
  latestKnown?: UpdateInfo | null;
  /** 用户主动忽略的版本号集合 */
  ignoredVersions?: string[];
}

export interface PersistedFavoritesShape {
  /** TrackId（bvid 或 bvid:p<n>） → 收藏时间戳（秒） */
  entries?: Record<string, number>;
}

export interface PersistedVideoPagePrefShape {
  /** bvid → 默认 P（>= 2） */
  defaultPage?: Record<string, number>;
}
