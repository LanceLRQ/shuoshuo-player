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
import type {
  PersistedBilibiliUserVideosShape,
  PersistedBilibiliVideosShape,
  PersistedCloudServiceShape,
  PersistedFavListShape,
  PersistedLyricsShape,
  PersistedPlayerProfileShape,
  PersistedPlayingListShape,
} from '../persisted-types';

/** 持久化数据的根 key */
export const PERSIST_DATA_KEY = 'player_data';

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
 * 7 个可持久化 store 的 hydrate / snapshot / subscribe 注册表
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
      useBilibiliUserVideosStore.setState({
        isLoading: false,
        infos: data.infos ?? {},
        space: data.space ?? {},
        favFolders: data.favFolders ?? {},
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
      usePlayingListStore.setState({
        favId: data.favId ?? '',
        bvIds: data.bvIds ?? [],
        current: data.current ?? '',
        playNext: false,
      });
    },
    snapshot() {
      const s = usePlayingListStore.getState();
      return { favId: s.favId, bvIds: s.bvIds, current: s.current };
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
