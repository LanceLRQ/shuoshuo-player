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
  apiBaseUrl?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * 应用初始化：在 createRoot.render() 之前调用，确保 store 状态先于 UI 渲染恢复
 *
 * 关键步骤（顺序敏感）：
 * 1. 优先单独恢复 baseURL（独立 storage key），早于任何云服务调用
 * 2. restoreState 读取 player_data 整体快照
 * 3. 按 store 拆分恢复，bili_user_videos.isLoading 强制重置为 false
 * 4. cloud_service.apiBaseUrl 触发 setApiBaseUrl，同步到 client + store
 * 5. 注册 7 个 store 的 subscribe → 节流写入 storage
 * 6. cloud_service.apiBaseUrl 单独 subscribe 到独立 storage key
 * 7. 监听 chrome.runtime onMessage 处理 wbi:refresh 事件
 */
export async function initializeApp(): Promise<void> {
  const bridge = getPlatformBridge();
  const { storage } = bridge;

  // 1. 优先恢复 baseURL（早于任何云服务请求）
  const savedBaseUrl = await storage.getItem(CLOUD_API_BASE_URL_STORAGE_KEY);
  setCloudApiBaseUrl(savedBaseUrl?.trim() || DEFAULT_CLOUD_API_BASE_URL);

  // 2. 读取整体持久化快照
  const snapshot = await restoreState(storage);

  // 3. 分别恢复各 store
  const userVideos = asRecord(snapshot.bili_user_videos) as PersistedUserVideosShape | null;
  if (userVideos) {
    // bili_user_videos 内部类型未在 shared/types 公开导出，
    // 这里走 unknown 转换，运行时形态由 persistSnapshot 写入端保证
    useBilibiliUserVideosStore.setState({
      isLoading: false, // 强制重置：恢复时不应停留在加载态
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
    const partial: Partial<PersistedUiProfileShape> = {};
    if (uiProfile.theme !== undefined) partial.theme = uiProfile.theme;
    if (uiProfile.volume !== undefined) partial.volume = uiProfile.volume;
    if (uiProfile.autoPlay !== undefined) partial.autoPlay = uiProfile.autoPlay;
    if (uiProfile.loopMode !== undefined) partial.loopMode = uiProfile.loopMode;
    usePlayerProfileStore.setState(partial);
  }

  const lyrics = asRecord(snapshot.lyrics) as PersistedLyricsShape | null;
  if (lyrics) {
    useLyricsStore.setState({ lyricMaps: lyrics.lyricMaps ?? {} });
  }

  const cloudService = asRecord(snapshot.cloud_service) as PersistedCloudServiceShape | null;
  if (cloudService) {
    if (cloudService.session) {
      useCloudServiceStore.getState().updateSession(cloudService.session);
    }
    if (cloudService.apiBaseUrl !== undefined) {
      // setApiBaseUrl 内部会同步 client（覆盖步骤 1 的兜底值）
      useCloudServiceStore.getState().setApiBaseUrl(cloudService.apiBaseUrl);
    }
  }

  // 4. 注册自动持久化（节流 1s 写入 player_data）
  const { persistState } = createPersistMiddleware(storage);
  const flushAll = () => persistState(collectPersistableState());

  useBilibiliVideosStore.subscribe(flushAll);
  useBilibiliUserVideosStore.subscribe(flushAll);
  usePlayingListStore.subscribe(flushAll);
  useFavListStore.subscribe(flushAll);
  usePlayerProfileStore.subscribe(flushAll);
  useLyricsStore.subscribe(flushAll);
  useCloudServiceStore.subscribe(flushAll);

  // 5. cloud_service.apiBaseUrl 单独同步到独立 storage key
  let lastBaseUrl = useCloudServiceStore.getState().apiBaseUrl;
  useCloudServiceStore.subscribe((state) => {
    if (state.apiBaseUrl === lastBaseUrl) return;
    lastBaseUrl = state.apiBaseUrl;
    void storage.setItem(CLOUD_API_BASE_URL_STORAGE_KEY, state.apiBaseUrl || '');
  });

  // 6. 订阅 background 的 wbi:refresh 广播
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg: unknown) => {
      if (
        msg &&
        typeof msg === 'object' &&
        (msg as { type?: string }).type === 'wbi:refresh'
      ) {
        void useBilibiliUserStore.getState().getLoginUserInfo();
      }
    });
  }
}

/**
 * 聚合所有可持久化 store 的当前状态
 * 注意：bili_user_videos 必须走 persistSnapshot() 清理 isLoading 等瞬态字段
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
    cloud_service: {
      session: cloud.session,
      apiBaseUrl: cloud.apiBaseUrl,
    },
  };
}
