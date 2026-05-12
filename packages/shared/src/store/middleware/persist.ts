import type { StorageAdapter } from '../../types';
import {
  CLOUD_API_BASE_URL_STORAGE_KEY,
  DEFAULT_CLOUD_API_BASE_URL,
  PERSIST_KEYS,
  PERSIST_THROTTLE_MS,
} from '../../constants';
import { setCloudApiBaseUrl } from '../../api';
import { getPlatformBridge } from '../../platform';
import { asRecord } from '../../utils';
import { useBilibiliVideosStore } from '../bilibili-videos';
import { useBilibiliUserVideosStore } from '../bilibili-user-videos';
import { usePlayingListStore } from '../playing-list';
import { useFavListStore } from '../fav-list';
import { usePlayerProfileStore } from '../player-profile';
import { useLyricsStore } from '../lyrics';
import { useCloudServiceStore } from '../cloud-service';
import { useMusicUrlCacheStore, type MusicUrlCacheEntry } from '../music-url-cache';
import { useUpdateCheckerStore } from '../update-checker';
import { useFavoritesStore } from '../favorites';
import { useVideoPagePrefStore } from '../video-page-pref';
import { hasPageSuffix, trackIdToBvid } from '../../utils/track-id';
import type { FavFolderCacheEntry, VideoListCacheEntry } from '../../types';
import type {
  PersistedBilibiliUserVideosShape,
  PersistedBilibiliVideosShape,
  PersistedCloudServiceShape,
  PersistedFavListShape,
  PersistedFavoritesShape,
  PersistedLyricsShape,
  PersistedMusicUrlCacheShape,
  PersistedPlayerProfileShape,
  PersistedPlayingListShape,
  PersistedUpdateCheckerShape,
  PersistedVideoPagePrefShape,
} from '../persisted-types';

/** 持久化数据的根 key */
export const PERSIST_DATA_KEY = 'player_data';

/**
 * §2 不变量防御（E3）：清洗 VideoListCacheEntry.video_list 中的 bvid 字段，
 * 若含 ':p<n>' 后缀（旧脏数据 / 错误手改），strip 回纯 bvid 形式。
 *
 * Fast path：先 O(N) `some` 扫描，无脏值时直接返回原 entry 引用，避免无效分配。
 */
function cleanVideoListEntry<T extends VideoListCacheEntry>(entry: T): T {
  if (!entry?.video_list?.length) return entry;
  if (!entry.video_list.some((it) => hasPageSuffix(it?.bvid))) return entry;
  const cleanedList = entry.video_list.map((it) =>
    hasPageSuffix(it?.bvid) ? { bvid: trackIdToBvid(it.bvid), created: it.created } : it,
  );
  return { ...entry, video_list: cleanedList };
}

function cleanInfosShape(infos: Record<string, VideoListCacheEntry>): typeof infos {
  const out: Record<string, VideoListCacheEntry> = {};
  for (const [mid, entry] of Object.entries(infos)) {
    out[mid] = cleanVideoListEntry(entry);
  }
  return out;
}

function cleanFavFoldersShape(folders: Record<string, FavFolderCacheEntry>): typeof folders {
  const out: Record<string, FavFolderCacheEntry> = {};
  for (const [id, entry] of Object.entries(folders)) {
    out[id] = cleanVideoListEntry(entry);
  }
  return out;
}

/**
 * 简易尾沿节流：在窗口期内最后一次调用会在窗口结束时执行
 * 单独实现是为避开 lodash-es 的类型导出问题（TS6 严格模式下 DebouncedFunc 不可移植）
 */
function trailingThrottle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void | Promise<void>,
  wait: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: TArgs | null = null;

  return (...args: TArgs) => {
    pending = args;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const next = pending;
      pending = null;
      if (next) void fn(...next);
    }, wait);
  };
}

export interface PersistMiddleware {
  persistState: (snapshot: Record<string, unknown>) => void;
}

/**
 * 创建跨平台持久化中间件
 * 由各平台（Chrome 扩展 / Tauri / Web）传入对应的 StorageAdapter
 *
 * 使用方式：调用方在 store 订阅时聚合所有 PERSIST_KEYS 对应 store 的快照，
 * 然后调 persistState(snapshot) 节流写入。
 */
export function createPersistMiddleware(adapter: StorageAdapter): PersistMiddleware {
  const persistState = trailingThrottle(async (snapshot: Record<string, unknown>) => {
    const data: Record<string, unknown> = {};
    for (const key of PERSIST_KEYS) {
      if (snapshot[key] !== undefined) {
        data[key] = snapshot[key];
      }
    }
    await adapter.setItem(PERSIST_DATA_KEY, JSON.stringify(data));
  }, PERSIST_THROTTLE_MS);

  return { persistState };
}

/** 从存储恢复状态 */
export async function restoreState(adapter: StorageAdapter): Promise<Record<string, unknown>> {
  try {
    const raw = await adapter.getItem(PERSIST_DATA_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* ─────────────────────── Persistence Registry ─────────────────────── */

interface StorePersistEntry {
  /** 与 PERSIST_KEYS 对应的存储键名 */
  readonly key: string;
  /** 反序列化路径：把 unknown 视图收窄并 setState */
  hydrate(raw: unknown): void;
  /** 写入路径：返回当前 store 的可持久化形状 */
  snapshot(): unknown;
  /** 订阅 store 变化（用于触发 flushAll 节流写入） */
  subscribe(cb: () => void): () => void;
}

/**
 * 11 个可持久化 store 的 hydrate / snapshot / subscribe 注册表
 *
 * 形状契约由 PersistedXxxShape 维护；
 * - bili_user_videos 的 isLoading 必须强制重置为 false，否则恢复后停在加载态
 * - cloud_service 仅持久化 session（apiBaseUrl 走独立 storage key 避免双源漂移）
 */
export const STORE_PERSIST_REGISTRY: ReadonlyArray<StorePersistEntry> = [
  {
    key: 'bili_videos',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedBilibiliVideosShape | null;
      if (!data) return;
      useBilibiliVideosStore.setState({
        ids: data.ids ?? [],
        entities: data.entities ?? {},
      });
    },
    snapshot() {
      const s = useBilibiliVideosStore.getState();
      return { ids: s.ids, entities: s.entities };
    },
    subscribe(cb) {
      return useBilibiliVideosStore.subscribe(cb);
    },
  },
  {
    key: 'bili_user_videos',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedBilibiliUserVideosShape | null;
      if (!data) return;
      // §2 不变量（E3）：UPLOADER / BILI_FAV 的 video_list[].bvid 永远是纯 bvid。
      // 旧持久化数据可能含脏字符串（如旧版/手改 import 注入了 :p<n>），hydrate 时 strip 防御。
      useBilibiliUserVideosStore.setState({
        isLoading: false,
        infos: cleanInfosShape(data.infos ?? {}),
        space: data.space ?? {},
        favFolders: cleanFavFoldersShape(data.favFolders ?? {}),
      });
    },
    snapshot() {
      return useBilibiliUserVideosStore.getState().persistSnapshot();
    },
    subscribe(cb) {
      return useBilibiliUserVideosStore.subscribe(cb);
    },
  },
  {
    key: 'playing_list',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedPlayingListShape | null;
      if (!data) return;
      // B2 兼容：旧字段名 bvIds 与新字段名 trackIds 都接受，优先新字段
      usePlayingListStore.setState({
        favId: data.favId ?? '',
        trackIds: data.trackIds ?? data.bvIds ?? [],
        current: data.current ?? '',
        playNext: false,
      });
    },
    snapshot() {
      const s = usePlayingListStore.getState();
      return { favId: s.favId, trackIds: s.trackIds, current: s.current };
    },
    subscribe(cb) {
      return usePlayingListStore.subscribe(cb);
    },
  },
  {
    key: 'fav_list',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedFavListShape | null;
      if (!data) return;
      useFavListStore.setState({ list: data.list ?? [] });
    },
    snapshot() {
      return { list: useFavListStore.getState().list };
    },
    subscribe(cb) {
      return useFavListStore.subscribe(cb);
    },
  },
  {
    key: 'ui_profile',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedPlayerProfileShape | null;
      if (!data) return;
      usePlayerProfileStore.setState(data);
    },
    snapshot() {
      const s = usePlayerProfileStore.getState();
      return {
        theme: s.theme,
        volume: s.volume,
        autoPlay: s.autoPlay,
        loopMode: s.loopMode,
        primaryColor: s.primaryColor,
        autoPlayNextPage: s.autoPlayNextPage,
      };
    },
    subscribe(cb) {
      return usePlayerProfileStore.subscribe(cb);
    },
  },
  {
    key: 'lyrics',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedLyricsShape | null;
      if (!data) return;
      useLyricsStore.setState({ lyricMaps: data.lyricMaps ?? {} });
    },
    snapshot() {
      return { lyricMaps: useLyricsStore.getState().lyricMaps };
    },
    subscribe(cb) {
      return useLyricsStore.subscribe(cb);
    },
  },
  {
    key: 'cloud_service',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedCloudServiceShape | null;
      if (!data?.session) return;
      useCloudServiceStore.getState().updateSession(data.session);
    },
    snapshot() {
      return { session: useCloudServiceStore.getState().session };
    },
    subscribe(cb) {
      return useCloudServiceStore.subscribe(cb);
    },
  },
  {
    key: 'music_url_cache',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedMusicUrlCacheShape | null;
      if (!data) return;
      // 自 A5 起 cache key 形态为 `${bvid}:${cid}`，丢弃旧形态（不含 ':'），
      // 防止旧持久化数据被错误命中（旧 value 有 cid 字段，新 value 无 cid）。
      const clean: Record<string, MusicUrlCacheEntry> = {};
      for (const [key, value] of Object.entries(data.entries ?? {})) {
        if (!key.includes(':')) continue;
        if (!value || typeof value !== 'object') continue;
        const v = value as { playUrl?: unknown; last_update?: unknown };
        if (typeof v.playUrl !== 'string' || typeof v.last_update !== 'number') continue;
        clean[key] = { playUrl: v.playUrl, last_update: v.last_update };
      }
      useMusicUrlCacheStore.setState({ entries: clean });
    },
    snapshot() {
      return useMusicUrlCacheStore.getState().persistSnapshot();
    },
    subscribe(cb) {
      return useMusicUrlCacheStore.subscribe(cb);
    },
  },
  {
    key: 'update_checker',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedUpdateCheckerShape | null;
      if (!data) return;
      useUpdateCheckerStore.setState({
        lastCheckedAt: data.lastCheckedAt ?? null,
        latestKnown: data.latestKnown ?? null,
        ignoredVersions: data.ignoredVersions ?? [],
        isChecking: false,
      });
    },
    snapshot() {
      return useUpdateCheckerStore.getState().persistSnapshot();
    },
    subscribe(cb) {
      return useUpdateCheckerStore.subscribe(cb);
    },
  },
  {
    key: 'favorites',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedFavoritesShape | null;
      if (!data) return;
      useFavoritesStore.setState({ entries: data.entries ?? {} });
    },
    snapshot() {
      return { entries: useFavoritesStore.getState().entries };
    },
    subscribe(cb) {
      return useFavoritesStore.subscribe(cb);
    },
  },
  {
    key: 'video_page_pref',
    hydrate(raw) {
      const data = asRecord(raw) as PersistedVideoPagePrefShape | null;
      if (!data) return;
      // 防御性过滤：忽略 page <= 1 / 非整数的脏值
      const clean: Record<string, number> = {};
      for (const [bvid, page] of Object.entries(data.defaultPage ?? {})) {
        if (typeof page === 'number' && Number.isInteger(page) && page >= 2) {
          clean[bvid] = page;
        }
      }
      useVideoPagePrefStore.setState({ defaultPage: clean });
    },
    snapshot() {
      return { defaultPage: useVideoPagePrefStore.getState().defaultPage };
    },
    subscribe(cb) {
      return useVideoPagePrefStore.subscribe(cb);
    },
  },
];

/**
 * 聚合所有可持久化 store 的当前快照
 * 由订阅回调（flushAll）统一调用，传入 createPersistMiddleware().persistState
 */
export function collectPersistableSnapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of STORE_PERSIST_REGISTRY) {
    out[entry.key] = entry.snapshot();
  }
  return out;
}

/**
 * 应用入口：恢复持久化状态 + 挂载订阅写回
 *
 * 顺序敏感的两条不变量：
 * - apiBaseUrl 必须早于任何云服务调用恢复（首屏请求应落到正确 baseURL）
 * - bili_user_videos.isLoading 必须强制重置为 false（避免恢复时停在加载态）
 *
 * 平台层只需先 setPlatformBridge() 注入 storage 适配器，本函数自行通过 getPlatformBridge() 拿桥接。
 *
 * apiBaseUrl 走独立 storage key（即时写），与 player_data（节流写）解耦，
 * 避免节流窗口内被覆盖造成双源漂移。
 */
export async function bootstrapPersistence(): Promise<void> {
  const { storage } = getPlatformBridge();

  const [savedBaseUrl, snapshot] = await Promise.all([
    storage.getItem(CLOUD_API_BASE_URL_STORAGE_KEY),
    restoreState(storage),
  ]);
  setCloudApiBaseUrl(savedBaseUrl?.trim() || DEFAULT_CLOUD_API_BASE_URL);

  for (const entry of STORE_PERSIST_REGISTRY) {
    if (snapshot[entry.key] !== undefined) {
      entry.hydrate(snapshot[entry.key]);
    }
  }

  const { persistState } = createPersistMiddleware(storage);

  // Hot-path 优化：订阅回调高频触发（如 SPlayer 进度更新），
  // 直接同步执行 collectPersistableSnapshot 会在每次 setState 都遍历 7 个 store。
  // 用 microtask 调度让同帧内的多次 setState 合并为单次快照收集，
  // 再交给已有的 trailingThrottle 写盘（避免重复抓取快照内容）。
  let scheduled = false;
  const scheduleFlush = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      persistState(collectPersistableSnapshot());
    });
  };
  for (const entry of STORE_PERSIST_REGISTRY) {
    entry.subscribe(scheduleFlush);
  }

  // apiBaseUrl 独立写入：仅在变化时直接调用 setItem，与 player_data 节流通道完全解耦
  let lastBaseUrl = useCloudServiceStore.getState().apiBaseUrl;
  useCloudServiceStore.subscribe((state) => {
    if (state.apiBaseUrl === lastBaseUrl) return;
    lastBaseUrl = state.apiBaseUrl;
    void storage.setItem(CLOUD_API_BASE_URL_STORAGE_KEY, state.apiBaseUrl || '');
  });
}
