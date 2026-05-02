/// <reference types="chrome" />
import {
  useBilibiliUserStore,
  useBilibiliVideosStore,
  useBilibiliUserVideosStore,
  usePlayingListStore,
  useFavListStore,
  usePlayerProfileStore,
  useLyricsStore,
  useCloudServiceStore,
  createPersistMiddleware,
  restoreState,
  CLOUD_API_BASE_URL_STORAGE_KEY,
  DEFAULT_CLOUD_API_BASE_URL,
  WBI_REFRESH_MESSAGE_TYPE,
  setCloudApiBaseUrl,
  type BilibiliVideo,
  type CloudServiceSession,
  type FavListItem,
  type LoopMode,
  type LyricEntry,
} from '@shuoshuo-player/shared';
import { getPlatformBridge } from './platform';

interface PersistedUserVideosShape {
  infos?: Record<string, unknown>;
  space?: Record<string, unknown>;
  favFolders?: Record<string, unknown>;
}
interface PersistedBilibiliVideosShape {
  ids?: string[];
  entities?: Record<string, BilibiliVideo>;
}
interface PersistedPlayingListShape {
  favId?: string;
  bvIds?: string[];
  current?: string;
}
interface PersistedFavListShape {
  list?: FavListItem[];
}
interface PersistedUiProfileShape {
  theme?: 'light' | 'dark' | 'auto';
  volume?: number;
  autoPlay?: boolean;
  loopMode?: LoopMode;
}
interface PersistedLyricsShape {
  lyricMaps?: Record<string, LyricEntry>;
}
interface PersistedCloudServiceShape {
  session?: CloudServiceSession;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isWbiRefreshMessage(msg: unknown): boolean {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: unknown }).type === WBI_REFRESH_MESSAGE_TYPE
  );
}

/**
 * 应用初始化：在 createRoot.render() 之前调用，store 状态需先于 UI 渲染恢复。
 *
 * 顺序敏感的两条不变量：
 * - baseURL 必须早于任何云服务调用恢复（否则首屏请求会落到默认 baseURL 再被覆盖）
 * - bili_user_videos.isLoading 必须强制重置为 false（避免恢复时停在加载态）
 *
 * apiBaseUrl 仅以独立 storage key 为唯一真相，不进入 player_data 快照，
 * 防止节流写入与即时写入两份数据漂移。
 */
export async function initializeApp(): Promise<void> {
  const bridge = getPlatformBridge();
  const { storage } = bridge;

  // baseURL 与 player_data 是两个独立的 storage key，并行读取减少冷启动 IPC 串行
  const [savedBaseUrl, snapshot] = await Promise.all([
    storage.getItem(CLOUD_API_BASE_URL_STORAGE_KEY),
    restoreState(storage),
  ]);
  setCloudApiBaseUrl(savedBaseUrl?.trim() || DEFAULT_CLOUD_API_BASE_URL);

  const userVideos = asRecord(snapshot.bili_user_videos) as PersistedUserVideosShape | null;
  if (userVideos) {
    // bili_user_videos 内部 entry 类型未在 shared/types 公开，转 unknown 以匹配 setState；
    // 运行时形态由写入侧 persistSnapshot() 保证
    useBilibiliUserVideosStore.setState({
      isLoading: false,
      infos: (userVideos.infos ?? {}) as never,
      space: (userVideos.space ?? {}) as never,
      favFolders: (userVideos.favFolders ?? {}) as never,
    });
  }

  const biliVideos = asRecord(snapshot.bili_videos) as PersistedBilibiliVideosShape | null;
  if (biliVideos) {
    useBilibiliVideosStore.setState({
      ids: biliVideos.ids ?? [],
      entities: biliVideos.entities ?? {},
    });
  }

  const playingList = asRecord(snapshot.playing_list) as PersistedPlayingListShape | null;
  if (playingList) {
    usePlayingListStore.setState({
      favId: playingList.favId ?? '',
      bvIds: playingList.bvIds ?? [],
      current: playingList.current ?? '',
      playNext: false,
    });
  }

  const favList = asRecord(snapshot.fav_list) as PersistedFavListShape | null;
  if (favList) {
    useFavListStore.setState({ list: favList.list ?? [] });
  }

  const uiProfile = asRecord(snapshot.ui_profile) as PersistedUiProfileShape | null;
  if (uiProfile) {
    // JSON.parse 不会产生 undefined 字段，setState 直接合并即可
    usePlayerProfileStore.setState(uiProfile);
  }

  const lyrics = asRecord(snapshot.lyrics) as PersistedLyricsShape | null;
  if (lyrics) {
    useLyricsStore.setState({ lyricMaps: lyrics.lyricMaps ?? {} });
  }

  const cloudService = asRecord(snapshot.cloud_service) as PersistedCloudServiceShape | null;
  if (cloudService?.session) {
    useCloudServiceStore.getState().updateSession(cloudService.session);
  }

  const { persistState } = createPersistMiddleware(storage);
  const flushAll = () => persistState(collectPersistableState());

  useBilibiliVideosStore.subscribe(flushAll);
  useBilibiliUserVideosStore.subscribe(flushAll);
  usePlayingListStore.subscribe(flushAll);
  useFavListStore.subscribe(flushAll);
  usePlayerProfileStore.subscribe(flushAll);
  useLyricsStore.subscribe(flushAll);
  useCloudServiceStore.subscribe(flushAll);

  // apiBaseUrl 走独立 storage key（即时写），与 player_data（节流写）解耦
  let lastBaseUrl = useCloudServiceStore.getState().apiBaseUrl;
  useCloudServiceStore.subscribe((state) => {
    if (state.apiBaseUrl === lastBaseUrl) return;
    lastBaseUrl = state.apiBaseUrl;
    void storage.setItem(CLOUD_API_BASE_URL_STORAGE_KEY, state.apiBaseUrl || '');
  });

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg: unknown) => {
      if (isWbiRefreshMessage(msg)) {
        void useBilibiliUserStore.getState().getLoginUserInfo();
      }
    });
  }
}

/**
 * 聚合可持久化 store 的当前状态。
 * bili_user_videos 必须走 persistSnapshot() 清理 isLoading 等瞬态字段；
 * apiBaseUrl 由独立 storage key 维护，故不在此快照中（避免双源漂移）。
 */
function collectPersistableState(): Record<string, unknown> {
  const userVideosSnap = useBilibiliUserVideosStore.getState().persistSnapshot();
  const profile = usePlayerProfileStore.getState();
  const cloud = useCloudServiceStore.getState();
  const playing = usePlayingListStore.getState();
  const biliVideos = useBilibiliVideosStore.getState();

  return {
    bili_videos: { ids: biliVideos.ids, entities: biliVideos.entities },
    bili_user_videos: userVideosSnap,
    playing_list: {
      favId: playing.favId,
      bvIds: playing.bvIds,
      current: playing.current,
    },
    fav_list: { list: useFavListStore.getState().list },
    ui_profile: {
      theme: profile.theme,
      volume: profile.volume,
      autoPlay: profile.autoPlay,
      loopMode: profile.loopMode,
    },
    lyrics: { lyricMaps: useLyricsStore.getState().lyricMaps },
    cloud_service: { session: cloud.session },
  };
}
