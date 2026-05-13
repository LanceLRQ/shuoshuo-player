import { create } from 'zustand';
import { MUSIC_URL_CACHE_TTL } from '../constants';
import { timeStampNow } from '../utils/format';

/**
 * 持久化的播放 URL 缓存条目（裁剪版）
 *
 * key 形态：`${bvid}:${cid}`（自 A5 起；旧版 `bvid` 单值在 hydrate 时被丢弃）。
 * cid 上提到 key 后，value 不再保存重复信息。
 *
 * 仅保留下次 fetchMusicUrl 命中所需的最小字段，不持久化 viewInfo / playInfo
 * 完整结构（体积可能 5-20KB/首），避免重度听众累计写入 player_data 造成膨胀。
 */
export interface MusicUrlCacheEntry {
  /** 已签名的播放 URL（B 站签名一般 ~90 分钟内有效） */
  playUrl: string;
  /** 写入时间戳（unix 秒）；与 MUSIC_URL_CACHE_TTL 比对决定是否过期 */
  last_update: number;
}

/** 组装缓存 key：`${bvid}:${cid}` */
export function makeCacheKey(bvid: string, cid: number): string {
  return `${bvid}:${cid}`;
}

interface MusicUrlCacheState {
  entries: Record<string, MusicUrlCacheEntry>;

  /** 命中且未过期则返回；否则返回 undefined（不主动删除过期项，由 persistSnapshot 统一清扫） */
  getValid: (bvid: string, cid: number) => MusicUrlCacheEntry | undefined;
  /** 写入或更新一条缓存（含 last_update 自动赋值） */
  upsert: (bvid: string, cid: number, entry: Omit<MusicUrlCacheEntry, 'last_update'>) => void;
  /**
   * 失效：
   * - 无参：清空全部
   * - 仅传 bvid：清空该 bvid 下所有 P（前缀匹配 `${bvid}:`）
   */
  invalidate: (bvid?: string) => void;
  /** 持久化前清扫已过期条目，避免长跑后 entries 单调增长 */
  persistSnapshot: () => Pick<MusicUrlCacheState, 'entries'>;
}

export const useMusicUrlCacheStore = create<MusicUrlCacheState>((set, get) => ({
  entries: {},

  getValid: (bvid, cid) => {
    const key = makeCacheKey(bvid, cid);
    const e = get().entries[key];
    if (!e || !e.playUrl) return undefined;
    if (e.last_update + MUSIC_URL_CACHE_TTL <= timeStampNow()) return undefined;
    return e;
  },

  upsert: (bvid, cid, payload) => {
    const key = makeCacheKey(bvid, cid);
    set((state) => ({
      entries: {
        ...state.entries,
        [key]: {
          playUrl: payload.playUrl,
          last_update: timeStampNow(),
        },
      },
    }));
  },

  invalidate: (bvid) => {
    if (!bvid) {
      set({ entries: {} });
      return;
    }
    set((state) => {
      const prefix = `${bvid}:`;
      let changed = false;
      const next: Record<string, MusicUrlCacheEntry> = {};
      for (const [k, v] of Object.entries(state.entries)) {
        if (k.startsWith(prefix)) {
          changed = true;
          continue;
        }
        next[k] = v;
      }
      if (!changed) return state;
      return { entries: next };
    });
  },

  persistSnapshot: () => {
    const now = timeStampNow();
    const next: Record<string, MusicUrlCacheEntry> = {};
    for (const [key, e] of Object.entries(get().entries)) {
      // 持久化前剔除已过期 / 旧形态（不含 ':'）的 entry
      if (!key.includes(':')) continue;
      if (e.last_update + MUSIC_URL_CACHE_TTL > now) next[key] = e;
    }
    return { entries: next };
  },
}));
