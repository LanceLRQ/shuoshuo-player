import { create } from 'zustand';
import type { BilibiliVideo } from '../types';

interface BilibiliVideosState {
  /** 按 created 倒序排列的 bvid 列表（v1 EntityAdapter sortComparer 等价） */
  ids: string[];
  entities: Record<string, BilibiliVideo>;

  upsertMany: (videos: Array<Partial<BilibiliVideo> & { bvid: string }>) => void;
  /**
   * 把指定 bvid 集合标记为 invalid=true。
   * 不存在的 bvid 直接忽略（不会创建空 entity）。
   * 供"重新拉取全部"投稿/收藏夹做删除对账时使用。
   */
  markVideosInvalid: (bvids: string[]) => void;
  getByBvid: (bvid: string) => BilibiliVideo | undefined;
  getOrderedAll: () => BilibiliVideo[];
}

export const useBilibiliVideosStore = create<BilibiliVideosState>((set, get) => ({
  ids: [],
  entities: {},

  upsertMany: (videos) =>
    set((state) => {
      const nextEntities = { ...state.entities };
      for (const video of videos) {
        const prev = nextEntities[video.bvid];
        // patch 未显式包含 invalid 字段时保留旧值——避免重新拉取到该视频时把已标失效的覆盖回有效
        // 远端真正"恢复"该视频时调用方需显式传 invalid=false 才能解除标记
        const merged = {
          ...(prev as BilibiliVideo | undefined),
          ...video,
        } as BilibiliVideo;
        if (prev?.invalid && !('invalid' in video)) {
          merged.invalid = true;
        }
        nextEntities[video.bvid] = merged;
      }
      // 重新排序：created 倒序，与 v1 EntityAdapter 行为一致
      const ids = Object.keys(nextEntities).sort((a, b) => {
        const ca = nextEntities[a]?.created ?? 0;
        const cb = nextEntities[b]?.created ?? 0;
        return cb - ca;
      });
      return { entities: nextEntities, ids };
    }),

  markVideosInvalid: (bvids) =>
    set((state) => {
      if (bvids.length === 0) return state;
      const nextEntities = { ...state.entities };
      let changed = false;
      for (const bvid of bvids) {
        const prev = nextEntities[bvid];
        if (!prev || prev.invalid) continue;
        nextEntities[bvid] = { ...prev, invalid: true };
        changed = true;
      }
      return changed ? { entities: nextEntities, ids: state.ids } : state;
    }),

  getByBvid: (bvid) => get().entities[bvid],

  getOrderedAll: () => {
    const { ids, entities } = get();
    return ids.map((id) => entities[id]).filter(Boolean) as BilibiliVideo[];
  },
}));
