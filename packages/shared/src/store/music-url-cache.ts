import { create } from 'zustand';
import { MUSIC_URL_CACHE_TTL } from '../constants';
import { timeStampNow } from '../utils/format';

/**
 * 持久化的播放 URL 缓存条目（裁剪版）
 *
 * 仅保留下次 fetchMusicUrl 命中所需的最小字段，不持久化 viewInfo / playInfo
 * 完整结构（体积可能 5-20KB/首），避免重度听众累计写入 player_data 造成膨胀。
 */
export interface MusicUrlCacheEntry {
  /** 已签名的播放 URL（B 站签名一般 ~90 分钟内有效） */
  playUrl: string;
  /** 写入时间戳（unix 秒）；与 MUSIC_URL_CACHE_TTL 比对决定是否过期 */
  last_update: number;
  /** 视频单 P 的 cid；若已知则下次 fetchMusicUrl 可直接调 playurl，跳过 view */
  cid?: number;
}

interface MusicUrlCacheState {
  entries: Record<string, MusicUrlCacheEntry>;

  /** 命中且未过期则返回；否则返回 undefined（不主动删除过期项，由 persistSnapshot 统一清扫） */
  getValid: (bvid: string) => MusicUrlCacheEntry | undefined;
  /** 写入或更新一条缓存（含 last_update 自动赋值） */
  upsert: (bvid: string, entry: Omit<MusicUrlCacheEntry, 'last_update'>) => void;
  /** 仅更新已有条目的 cid（view 调用回填用，不影响 last_update / playUrl 状态） */
  upsertCidOnly: (bvid: string, cid: number) => void;
  /** 单条 / 全部失效（与 invalidateMusicUrlCache 入参对齐） */
  invalidate: (bvid?: string) => void;
  /** 持久化前清扫已过期条目，避免长跑后 entries 单调增长 */
  persistSnapshot: () => Pick<MusicUrlCacheState, 'entries'>;
}

export const useMusicUrlCacheStore = create<MusicUrlCacheState>((set, get) => ({
  entries: {},

  getValid: (bvid) => {
    const e = get().entries[bvid];
    if (!e || !e.playUrl) return undefined;
    if (e.last_update + MUSIC_URL_CACHE_TTL <= timeStampNow()) return undefined;
    return e;
  },

  upsert: (bvid, payload) => {
    set((state) => ({
      entries: {
        ...state.entries,
        [bvid]: {
          playUrl: payload.playUrl,
          cid: payload.cid,
          last_update: timeStampNow(),
        },
      },
    }));
  },

  upsertCidOnly: (bvid, cid) => {
    set((state) => {
      const old = state.entries[bvid];
      // 没有现成条目就不写：避免拉一个 playUrl='' 的孤儿项被 getValid 当成 hit
      if (!old) return state;
      if (old.cid === cid) return state;
      return { entries: { ...state.entries, [bvid]: { ...old, cid } } };
    });
  },

  invalidate: (bvid) => {
    if (!bvid) {
      set({ entries: {} });
      return;
    }
    set((state) => {
      if (!state.entries[bvid]) return state;
      const next = { ...state.entries };
      delete next[bvid];
      return { entries: next };
    });
  },

  persistSnapshot: () => {
    const now = timeStampNow();
    const next: Record<string, MusicUrlCacheEntry> = {};
    for (const [bvid, e] of Object.entries(get().entries)) {
      // 持久化前剔除已过期的 entry：避免重启后 entries 单调累积
      if (e.last_update + MUSIC_URL_CACHE_TTL > now) next[bvid] = e;
    }
    return { entries: next };
  },
}));
