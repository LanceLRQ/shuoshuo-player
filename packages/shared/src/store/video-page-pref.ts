import { create } from 'zustand';

/**
 * 多 P 视频的"默认 P"用户偏好
 *
 * 仅记录"用户主动选过的非默认 P"（page >= 2）；page === 1 视为无偏好并自动删除 key，
 * 避免长期累积大量等价于默认值的 key 撑大 player_data。
 *
 * 仅作用于：
 * - UPLOADER / BILI_FAV 列表中纯 bvid 条目的播放
 * - 自定义歌单 / 我的收藏中纯 bvid 条目的播放
 *
 * 不影响：
 * - 显式 `bvid:p<n>` TrackId（它本身就指定了 P）
 */
interface VideoPagePrefState {
  /** bvid → 默认 P（数值范围 >= 2） */
  defaultPage: Record<string, number>;

  /** 设置默认 P；传入 page <= 1 视为清空（删 key） */
  setDefaultPage: (bvid: string, page: number) => void;
  /** 清除某 bvid 的默认 P 设置 */
  clearDefaultPage: (bvid: string) => void;
  /** 读取默认 P；无设置时返回 1 */
  getDefaultPage: (bvid: string) => number;
}

export const useVideoPagePrefStore = create<VideoPagePrefState>((set, get) => ({
  defaultPage: {},

  setDefaultPage: (bvid, page) => {
    if (!bvid) return;
    if (!Number.isInteger(page) || page <= 1) {
      const existing = get().defaultPage;
      if (!(bvid in existing)) return;
      const next = { ...existing };
      delete next[bvid];
      set({ defaultPage: next });
      return;
    }
    set((state) => ({
      defaultPage: { ...state.defaultPage, [bvid]: page },
    }));
  },

  clearDefaultPage: (bvid) => {
    const existing = get().defaultPage;
    if (!(bvid in existing)) return;
    const next = { ...existing };
    delete next[bvid];
    set({ defaultPage: next });
  },

  getDefaultPage: (bvid) => {
    return get().defaultPage[bvid] ?? 1;
  },
}));
