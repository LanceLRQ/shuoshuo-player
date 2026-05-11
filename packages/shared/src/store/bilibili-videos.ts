import { create } from 'zustand';
import type { BilibiliVideo } from '../types';

interface BilibiliVideosState {
  /** 按 created 倒序排列的 bvid 列表（v1 EntityAdapter sortComparer 等价） */
  ids: string[];
  entities: Record<string, BilibiliVideo>;

  upsertMany: (videos: Array<Partial<BilibiliVideo> & { bvid: string }>) => void;
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
        nextEntities[video.bvid] = {
          ...(prev as BilibiliVideo | undefined),
          ...video,
        } as BilibiliVideo;
      }
      // 重新排序：created 倒序，与 v1 EntityAdapter 行为一致
      const ids = Object.keys(nextEntities).sort((a, b) => {
        const ca = nextEntities[a]?.created ?? 0;
        const cb = nextEntities[b]?.created ?? 0;
        return cb - ca;
      });
      return { entities: nextEntities, ids };
    }),

  getByBvid: (bvid) => get().entities[bvid],

  getOrderedAll: () => {
    const { ids, entities } = get();
    return ids.map((id) => entities[id]).filter(Boolean) as BilibiliVideo[];
  },
}));
