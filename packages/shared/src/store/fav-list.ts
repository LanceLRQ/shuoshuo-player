import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { FavListType, type FavListItem } from '../types';
import { timeStampNow, parseTrackId, trackIdToBvid, logger } from '../utils';
import { MASTER_UP_INFO, NoticeType } from '../constants';
import { useBilibiliUserVideosStore } from './bilibili-user-videos';
import { useBilibiliVideosStore } from './bilibili-videos';
import { useUIStore } from './ui';

/**
 * 校验单条 TrackId 写入是否合法（§2 列表语义边界 Phase E）：
 *
 * - UPLOADER / BILI_FAV：bv_ids 永远是纯 bvid，禁止任何 :p<n> 形式 → 拒绝写入
 * - CUSTOM：接受纯 bvid 或 bvid:p<n>，但要求 TrackId 形式合法
 *
 * 返回 true 视为可写入；false 则调用方静默忽略（带 debug log）。
 */
function isWritableTrackId(trackId: string, type: FavListType): boolean {
  const parsed = parseTrackId(trackId);
  if (!parsed) {
    logger.debug('[FAV-LIST]', 'reject malformed trackId', { trackId, type });
    return false;
  }
  if (type !== FavListType.CUSTOM && parsed.page !== undefined) {
    logger.warn('[FAV-LIST]', 'reject :p<n> trackId on non-CUSTOM fav', { trackId, type });
    return false;
  }
  return true;
}

interface FavListState {
  list: FavListItem[];

  addFavList: (item: Omit<FavListItem, 'id' | 'create_time' | 'update_time'>) => FavListItem | null;
  removeFavList: (id: string) => void;
  modFavList: (id: string, name: string) => void;
  /** 添加单条 TrackId（纯 bvid 或 bvid:p&lt;n&gt;）到 CUSTOM 歌单 */
  addFavVideo: (favId: string, trackId: string) => void;
  removeFavVideo: (favId: string, trackId: string) => void;
  /** 批量添加 TrackId 到 CUSTOM 歌单（仅写入，不拉取视频信息；用于 import） */
  batchAddFavVideos: (favId: string, trackIds: string[]) => void;
  /** v1 addFavVideoByBvids：循环拉取视频信息（按 trackId 剥离的 bvid）+ 进度通知 */
  addFavVideoByBvids: (
    favId: string,
    trackIds: string[],
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

  addFavVideo: (favId, trackId) =>
    set((state) => ({
      list: state.list.map((item) => {
        if (item.id !== favId || item.type !== FavListType.CUSTOM) return item;
        // §2 校验：CUSTOM 只接受合法 TrackId（纯 bvid 或 bvid:p<n>）
        if (!isWritableTrackId(trackId, item.type)) return item;
        if (item.bv_ids.includes(trackId)) return item;
        return {
          ...item,
          bv_ids: [...item.bv_ids, trackId],
          update_time: timeStampNow(),
        };
      }),
    })),

  removeFavVideo: (favId, trackId) =>
    set((state) => ({
      list: state.list.map((item) => {
        if (item.id !== favId || item.type === FavListType.UPLOADER) return item;
        return {
          ...item,
          bv_ids: item.bv_ids.filter((id) => id !== trackId),
          update_time: timeStampNow(),
        };
      }),
    })),

  batchAddFavVideos: (favId, trackIds) =>
    set((state) => ({
      list: state.list.map((item) => {
        if (item.id !== favId || item.type !== FavListType.CUSTOM) return item;
        // §2 校验：过滤非法 TrackId（保留纯 bvid 与合法 bvid:p<n>）
        const filtered = trackIds.filter((id) => isWritableTrackId(id, item.type));
        const newIds = filtered.filter((id) => !item.bv_ids.includes(id));
        return {
          ...item,
          bv_ids: [...item.bv_ids, ...newIds],
          update_time: timeStampNow(),
        };
      }),
    })),

  addFavVideoByBvids: async (favId, trackIds) => {
    const ui = useUIStore.getState();
    const userVideos = useBilibiliUserVideosStore.getState();
    const { entities } = useBilibiliVideosStore.getState();
    // 按 bvid 去重 view 调用：多 P 投稿 N 个 P 共享同一 view 结果。
    // 此前每 P 各调一次 view，B 站对同 bvid 高频 view 易触发限流 → 仅首次成功、后续 failed，
    // 导致用户选 N 个 P 实际只入库 1 条。
    const uniqueBvids = Array.from(new Set(trackIds.map(trackIdToBvid)));
    // 缓存短路：entity 已存在的 bvid 跳过 view 调用——避免合集场景下 150 条逐条请求 + 进度 toast 抽搐
    const missingBvids = uniqueBvids.filter((b) => !entities[b]);
    const viewResults = new Map<string, boolean>();
    for (const b of uniqueBvids) {
      if (entities[b]) viewResults.set(b, true);
    }
    for (let i = 0; i < missingBvids.length; i++) {
      const bvId = missingBvids[i];
      const ok = await userVideos.getVideoByBvid(bvId, i + 1, missingBvids.length);
      viewResults.set(bvId, ok);
    }

    // 一次性 batch 写入：避免 N 次 setState 触发 N 次持久化与组件 rerender
    const okTrackIds = trackIds.filter((tid) => viewResults.get(trackIdToBvid(tid)));
    get().batchAddFavVideos(favId, okTrackIds);
    const success = okTrackIds.length;
    const failed = trackIds.length - success;
    ui.sendNotice({
      type: NoticeType.SUCCESS,
      message: `添加完成(成功:${success},失败:${failed})`,
      duration: 3000,
    });
    return { success, failed };
  },
}));
