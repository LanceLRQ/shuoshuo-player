import { create } from 'zustand';
import type { LiveSlicerCacheEntry, LiveSlicerMan } from '../types';
import {
  LIVE_SLICER_CARD_FETCH_CONCURRENCY,
  LIVE_SLICER_CARD_FETCH_INTERVAL_MS,
  LIVE_SLICER_CARD_REFRESH_THRESHOLD,
} from '../constants';
import { UserApi } from '../api';
import { timeStampNow } from '../utils';

interface LiveSlicerCacheState {
  /** mid → 主播缓存条目 */
  entries: Record<string, LiveSlicerCacheEntry>;
  isRefreshing: boolean;

  /**
   * 批量刷新主播 card 信息（粉丝数 / 投稿数）。
   * 仅刷 force 或超过 LIVE_SLICER_CARD_REFRESH_THRESHOLD 的条目；
   * 限并发 + 间隔避免 B 站 IP 维度风控；单条失败保留旧缓存、不阻塞队列。
   */
  refreshSlicers: (slicers: LiveSlicerMan[], opts?: { force?: boolean }) => Promise<void>;
  /** 清除某主播的未读标记（用户点该卡片后调用） */
  markRead: (mid: string) => void;
  /** 持久化前清理瞬态字段（isRefreshing 不入库） */
  persistSnapshot: () => Pick<LiveSlicerCacheState, 'entries'>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useLiveSlicerCacheStore = create<LiveSlicerCacheState>((set, get) => ({
  entries: {},
  isRefreshing: false,

  refreshSlicers: async (slicers, opts) => {
    if (get().isRefreshing) return;
    const now = timeStampNow();
    const force = opts?.force ?? false;
    const { entries } = get();
    const due = slicers.filter((s) => {
      const entry = entries[s.mid];
      return force || !entry || now - entry.lastFetchedAt > LIVE_SLICER_CARD_REFRESH_THRESHOLD;
    });
    if (due.length === 0) return;

    set({ isRefreshing: true });
    try {
      let cursor = 0;
      const worker = async (): Promise<void> => {
        while (cursor < due.length) {
          const slicer = due[cursor++];
          if (!slicer) break;
          try {
            const card = await UserApi.getUserCard({ params: { mid: slicer.mid } });
            const newCount = card?.archive_count ?? 0;
            const follower = card?.follower ?? 0;
            const name = card?.card?.name ?? slicer.name;
            const face = card?.card?.face ?? slicer.face;
            set((state) => {
              const old = state.entries[slicer.mid];
              const ts = timeStampNow();
              // 差分判定：仅投稿数「增加」才记为有更新；减少（删稿）只刷新基线
              let lastUpdatedAt = old?.lastUpdatedAt ?? 0;
              let lastDelta = old?.lastDelta ?? 0;
              let hasUnread = old?.hasUnread ?? false;
              if (old && newCount > old.archiveCount) {
                lastUpdatedAt = ts;
                lastDelta = newCount - old.archiveCount;
                hasUnread = true;
              }
              const next: LiveSlicerCacheEntry = {
                mid: slicer.mid,
                name,
                face,
                follower,
                archiveCount: newCount,
                lastFetchedAt: ts,
                lastUpdatedAt,
                lastDelta,
                hasUnread,
              };
              return { entries: { ...state.entries, [slicer.mid]: next } };
            });
          } catch {
            // 单条失败：保留旧缓存，下次再补
          }
          if (cursor < due.length) await sleep(LIVE_SLICER_CARD_FETCH_INTERVAL_MS);
        }
      };
      const workers = Array.from(
        { length: Math.min(LIVE_SLICER_CARD_FETCH_CONCURRENCY, due.length) },
        () => worker(),
      );
      await Promise.all(workers);
    } finally {
      set({ isRefreshing: false });
    }
  },

  markRead: (mid) => {
    const entry = get().entries[mid];
    if (!entry || !entry.hasUnread) return;
    set((state) => ({
      entries: { ...state.entries, [mid]: { ...entry, hasUnread: false } },
    }));
  },

  persistSnapshot: () => ({ entries: get().entries }),
}));
