import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { FavListType, type FavListItem } from '../types';
import { timeStampNow } from '../utils';
import { MASTER_UP_INFO, NoticeType } from '../constants';
import { useBilibiliUserVideosStore } from './bilibili-user-videos';
import { useUIStore } from './ui';

interface FavListState {
  list: FavListItem[];

  addFavList: (item: Omit<FavListItem, 'id' | 'create_time' | 'update_time'>) => FavListItem | null;
  removeFavList: (id: string) => void;
  modFavList: (id: string, name: string) => void;
  addFavVideo: (favId: string, bvId: string) => void;
  removeFavVideo: (favId: string, bvId: string) => void;
  /** 批量添加（仅写入，不拉取视频信息；用于 import） */
  batchAddFavVideos: (favId: string, bvIds: string[]) => void;
  /** v1 addFavVideoByBvids：循环拉取视频信息 + 进度通知 */
  addFavVideoByBvids: (
    favId: string,
    bvIds: string[],
  ) => Promise<{ success: number; failed: number }>;
}

export const useFavListStore = create<FavListState>((set, get) => ({
  list: [],

  addFavList: (item) => {
    // v1 规则：UPLOADER 类型必须有 mid，且不能与 master mid 冲突
    if (item.type === FavListType.UPLOADER) {
      if (!item.mid) return null;
      if (Number(item.mid) === MASTER_UP_INFO.mid) return null;
    }
    const now = timeStampNow();
    const newItem: FavListItem = {
      ...item,
      id: nanoid(),
      bv_ids: item.bv_ids || [],
      create_time: now,
      update_time: 0,
    };
    set((state) => ({ list: [...state.list, newItem] }));
    return newItem;
  },

  removeFavList: (id) => set((state) => ({ list: state.list.filter((item) => item.id !== id) })),

  modFavList: (id, name) =>
    set((state) => ({
      list: state.list.map((item) =>
        item.id === id ? { ...item, name, update_time: timeStampNow() } : item,
      ),
    })),

  addFavVideo: (favId, bvId) =>
    set((state) => ({
      list: state.list.map((item) => {
        if (item.id !== favId || item.type !== FavListType.CUSTOM) return item;
        if (item.bv_ids.includes(bvId)) return item;
        return {
          ...item,
          bv_ids: [...item.bv_ids, bvId],
          update_time: timeStampNow(),
        };
      }),
    })),

  removeFavVideo: (favId, bvId) =>
    set((state) => ({
      list: state.list.map((item) => {
        if (item.id !== favId || item.type === FavListType.UPLOADER) return item;
        return {
          ...item,
          bv_ids: item.bv_ids.filter((id) => id !== bvId),
          update_time: timeStampNow(),
        };
      }),
    })),

  batchAddFavVideos: (favId, bvIds) =>
    set((state) => ({
      list: state.list.map((item) => {
        if (item.id !== favId || item.type !== FavListType.CUSTOM) return item;
        const newIds = bvIds.filter((id) => !item.bv_ids.includes(id));
        return {
          ...item,
          bv_ids: [...item.bv_ids, ...newIds],
          update_time: timeStampNow(),
        };
      }),
    })),

  addFavVideoByBvids: async (favId, bvIds) => {
    const ui = useUIStore.getState();
    const userVideos = useBilibiliUserVideosStore.getState();
    let success = 0;
    let failed = 0;
    for (let i = 0; i < bvIds.length; i++) {
      const bvId = bvIds[i];
      const ok = await userVideos.getVideoByBvid(bvId, i + 1, bvIds.length);
      if (ok) {
        get().addFavVideo(favId, bvId);
        success++;
      } else {
        failed++;
      }
    }
    ui.sendNotice({
      type: NoticeType.SUCCESS,
      message: `添加完成(成功:${success},失败:${failed})`,
      duration: 3000,
    });
    return { success, failed };
  },
}));
