/**
 * 7 个持久化 store 的"对外快照形状"统一定义
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
  CloudServiceSession,
  FavFolderCacheEntry,
  FavListItem,
  LoopMode,
  LyricEntry,
  VideoListCacheEntry,
} from '../types';

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
}

export interface PersistedLyricsShape {
  lyricMaps?: Record<string, LyricEntry>;
}

export interface PersistedCloudServiceShape {
  session?: CloudServiceSession;
}
