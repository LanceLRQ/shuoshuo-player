import { create } from 'zustand';
import { timeStampNow } from '../utils';

/**
 * 系统级「我的收藏」store
 *
 * 设计要点：
 * - entries 同时承载存在性 + 排序权重（bvid → 收藏时间戳，秒）
 * - 与 useFavListStore 完全独立：不出现在 list[]，不参与 fav_list 合并
 * - 路由保留字 ID 由调用方约定（packages/web 的 fav-list.tsx 用 'favorites'）
 *
 * 重复 add 时**不覆盖原时间戳**：保留"首次喜欢"的真实时间，避免误触改变排序位
 */
interface FavoritesState {
  entries: Record<string, number>;

  isFavored(bvid: string): boolean;
  /** 切换收藏状态，返回切换后是否处于已收藏态 */
  toggle(bvid: string): boolean;
  /** 已存在则保留原时间戳；不存在则写入当前秒级时间戳 */
  add(bvid: string): void;
  remove(bvid: string): void;
  clear(): void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  entries: {},

  isFavored: (bvid) => bvid in get().entries,

  toggle: (bvid) => {
    const existing = get().entries;
    if (bvid in existing) {
      const next = { ...existing };
      delete next[bvid];
      set({ entries: next });
      return false;
    }
    set({ entries: { ...existing, [bvid]: timeStampNow() } });
    return true;
  },

  add: (bvid) => {
    const existing = get().entries;
    if (bvid in existing) return;
    set({ entries: { ...existing, [bvid]: timeStampNow() } });
  },

  remove: (bvid) => {
    const existing = get().entries;
    if (!(bvid in existing)) return;
    const next = { ...existing };
    delete next[bvid];
    set({ entries: next });
  },

  clear: () => set({ entries: {} }),
}));

/** 排序方向：desc=最新收藏在前 / asc=最早收藏在前 */
export type FavoritesOrder = 'desc' | 'asc';

/**
 * 派生：按时间戳排序后的 bvid 列表
 *
 * 同时间戳时按 bvid 字典序保证稳定（Object.entries 顺序在不同 JS 引擎下不保证）
 */
export function selectSortedBvids(
  entries: Record<string, number>,
  order: FavoritesOrder,
): string[] {
  const pairs = Object.entries(entries);
  pairs.sort((a, b) => {
    const tsDiff = order === 'desc' ? b[1] - a[1] : a[1] - b[1];
    if (tsDiff !== 0) return tsDiff;
    return a[0].localeCompare(b[0]);
  });
  return pairs.map(([bvid]) => bvid);
}
