import { create } from 'zustand';
import { pick } from 'lodash-es';
import type { BilibiliSpaceInfo, VideoListCacheEntry, FavFolderCacheEntry } from '../types';
import { BILIBILI_SPACE_INFO_FIELDS, NoticeType } from '../constants';
import { UserApi, VideoApi } from '../api';
import { useBilibiliVideosStore } from './bilibili-videos';
import { useUIStore } from './ui';
import { timeStampNow, pickVideosFields } from '../utils';

type VideoListItem = { bvid: string; created: number };

/**
 * 拉取模式：
 * - 'incremental'：从 page 1 起逐页比对 localBvids，碰到已知 bvid 即停（最多 5 页）；
 *   缓存空时 fallback 拉前 3 页（90 条），避免新用户一次性全拉触发风控
 * - 'range'：按 opts.fromPage / toPage 串行拉指定页范围
 * - 'fully'：串行拉所有页，结束后做"删除对账"——本地存在但远端不存在的 bvid 标记 invalid
 * - 'default'：兼容旧调用方（home.tsx 等），路由到 'incremental'
 */
export type UserVideosFetchMode = 'incremental' | 'range' | 'fully' | 'default';

interface FetchRangeOpts {
  fromPage?: number;
  toPage?: number;
}

interface BilibiliUserVideosState {
  isLoading: boolean;
  /** 已拉条数（供 MediaLoadingDialog 进度显示） */
  loaded: number;
  /** 远端总数（供进度条分母；不一定准确，B 站偶发返回旧值） */
  progressTotal: number;
  /** mid → 投稿视频列表缓存 */
  infos: Record<string, VideoListCacheEntry>;
  /** mid → 空间信息（含 stats） */
  space: Record<string, BilibiliSpaceInfo>;
  /** folder_id → 收藏夹缓存 */
  favFolders: Record<string, FavFolderCacheEntry>;

  readUserVideos: (
    mid: string | number,
    mode?: UserVideosFetchMode,
    opts?: FetchRangeOpts,
  ) => Promise<void>;
  readUserFavFolderVideos: (
    mediaId: string | number,
    mode?: UserVideosFetchMode,
    opts?: FetchRangeOpts,
  ) => Promise<void>;
  readUserSpaceInfo: (mid: string | number) => Promise<void>;
  getVideoByBvid: (bvId: string, index?: number, total?: number) => Promise<boolean>;

  /**
   * 取消当前进行中的拉取任务（投稿/收藏夹共享）。
   * 实现：递增 fetch token 让正在跑的循环早退；setState 立即把 isLoading 置 false。
   * 已经在飞的单页 HTTP 仍会跑完，但响应回写 state 时会被 token 拦截。
   */
  cancelRefresh: () => void;

  /** 持久化前清理瞬态字段 */
  persistSnapshot: () => Pick<
    BilibiliUserVideosState,
    'isLoading' | 'infos' | 'space' | 'favFolders'
  >;
}

const DEFAULT_ENTRY: VideoListCacheEntry = {
  update_time: 0,
  video_list: [],
  count: 0,
  update_type: '',
};

const PAGE_SIZE = 30;
const PAGE_SLEEP_MS = 300;
/** 缓存空时 fallback 拉的页数（90 条），避免首次全拉风控 */
const FIRST_LOAD_PAGES = 3;
/** 增量模式最多翻的页数（防御兜底：若 UP 主一口气更新 >150 条新视频，停止追翻） */
const INCREMENTAL_MAX_PAGES = 5;

/** 内部辅助：合并新数据到现有 video_list（重复则更新，否则追加），然后按 created 倒序 */
function mergeVideoList(current: VideoListItem[], incoming: VideoListItem[]): VideoListItem[] {
  const next = [...current];
  for (const v of incoming) {
    const picked: VideoListItem = { bvid: v.bvid, created: v.created };
    const idx = next.findIndex((it) => it.bvid === picked.bvid);
    if (idx >= 0) next[idx] = picked;
    else next.push(picked);
  }
  return next.sort((a, b) => (a.created > b.created ? -1 : 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 模块级 fetch token：投稿/收藏夹两个拉取流程共享同一个 token，
 * 因为防重入靠 isLoading 互斥（同一时间只有一个在跑），cancel 时递增即可让其早退。
 */
let activeFetchId = 0;

export const useBilibiliUserVideosStore = create<BilibiliUserVideosState>((set, get) => ({
  isLoading: false,
  loaded: 0,
  progressTotal: 0,
  infos: {},
  space: {},
  favFolders: {},

  readUserVideos: async (mid, mode = 'incremental', opts) => {
    if (get().isLoading) return;
    const effectiveMode: Exclude<UserVideosFetchMode, 'default'> =
      mode === 'default' ? 'incremental' : mode;
    const fetchId = ++activeFetchId;
    set({ isLoading: true, loaded: 0, progressTotal: 0 });
    const ui = useUIStore.getState();
    const midKey = String(mid);

    /** 拉单页并 merge 进 store；返回该页 archives + 远端 total，cancel 后返回 null */
    const fetchPage = async (
      pn: number,
    ): Promise<{ videoList: VideoListItem[]; total: number } | null> => {
      try {
        const data = await UserApi.getUserVideoList({ params: { mid, pn, ps: PAGE_SIZE } });
        if (activeFetchId !== fetchId) return null;
        const videoList = (data?.list?.vlist ?? []) as VideoListItem[];
        const total = data?.page?.count ?? 0;
        set((state) => {
          const entry: VideoListCacheEntry = { ...(state.infos[midKey] ?? DEFAULT_ENTRY) };
          entry.video_list = mergeVideoList(entry.video_list, videoList);
          entry.count = total;
          entry.update_time = timeStampNow();
          entry.update_type = effectiveMode;
          return { infos: { ...state.infos, [midKey]: entry } };
        });
        useBilibiliVideosStore.getState().upsertMany(pickVideosFields(videoList, 'default'));
        return { videoList, total };
      } catch {
        if (activeFetchId !== fetchId) return null;
        ui.sendNotice({
          type: NoticeType.ERROR,
          message: '获取投稿列表失败',
          duration: 3000,
        });
        return null;
      }
    };

    try {
      if (effectiveMode === 'incremental') {
        const entry = get().infos[midKey] ?? DEFAULT_ENTRY;
        const localBvids = new Set(entry.video_list.map((v) => v.bvid));
        if (localBvids.size === 0) {
          for (let pn = 1; pn <= FIRST_LOAD_PAGES; pn++) {
            if (activeFetchId !== fetchId) return;
            const r = await fetchPage(pn);
            if (!r || activeFetchId !== fetchId) return;
            const localCount = get().infos[midKey]?.video_list.length ?? 0;
            set({
              progressTotal: Math.min(r.total, FIRST_LOAD_PAGES * PAGE_SIZE),
              loaded: localCount,
            });
            const totalPages = Math.ceil(r.total / PAGE_SIZE);
            if (pn >= totalPages) break;
            await sleep(PAGE_SLEEP_MS);
          }
        } else {
          for (let pn = 1; pn <= INCREMENTAL_MAX_PAGES; pn++) {
            if (activeFetchId !== fetchId) return;
            const r = await fetchPage(pn);
            if (!r || activeFetchId !== fetchId) return;
            const localCount = get().infos[midKey]?.video_list.length ?? 0;
            set({ progressTotal: r.total, loaded: localCount });
            const incomingNew = r.videoList.filter((v) => !localBvids.has(v.bvid));
            // 本页无新增 → 已经覆盖到本地最早 bvid，停止
            if (incomingNew.length === 0) break;
            // 本页有部分已知 → 这是分界点，merge 后停止
            if (incomingNew.length < r.videoList.length) break;
            // 本页全是新的 → 把这些加进 localBvids 继续翻下一页
            incomingNew.forEach((v) => localBvids.add(v.bvid));
            const totalPages = Math.ceil(r.total / PAGE_SIZE);
            if (pn >= totalPages) break;
            await sleep(PAGE_SLEEP_MS);
          }
        }
      } else if (effectiveMode === 'range') {
        const fromPage = Math.max(1, opts?.fromPage ?? 1);
        const firstR = await fetchPage(fromPage);
        if (!firstR || activeFetchId !== fetchId) return;
        const totalPages = Math.ceil(firstR.total / PAGE_SIZE);
        const toPage = Math.min(opts?.toPage ?? fromPage, totalPages);
        set({
          progressTotal: (toPage - fromPage + 1) * PAGE_SIZE,
          loaded: firstR.videoList.length,
        });
        for (let pn = fromPage + 1; pn <= toPage; pn++) {
          await sleep(PAGE_SLEEP_MS);
          if (activeFetchId !== fetchId) return;
          const r = await fetchPage(pn);
          if (!r || activeFetchId !== fetchId) return;
          set((s) => ({ loaded: s.loaded + r.videoList.length }));
        }
      } else if (effectiveMode === 'fully') {
        const remoteBvids = new Set<string>();
        let pn = 1;
        let totalPages = -1;
        while (totalPages === -1 || pn <= totalPages) {
          if (activeFetchId !== fetchId) return;
          const r = await fetchPage(pn);
          if (!r || activeFetchId !== fetchId) return;
          r.videoList.forEach((v) => remoteBvids.add(v.bvid));
          totalPages = Math.ceil(r.total / PAGE_SIZE);
          set({ progressTotal: r.total, loaded: remoteBvids.size });
          if (pn >= totalPages) break;
          pn++;
          await sleep(PAGE_SLEEP_MS);
        }
        // 删除对账：本地存在但远端这次没拉到的 bvid → 标记 invalid
        const localBvids = (get().infos[midKey]?.video_list ?? []).map((v) => v.bvid);
        const toInvalidate = localBvids.filter((b) => !remoteBvids.has(b));
        if (toInvalidate.length > 0 && activeFetchId === fetchId) {
          useBilibiliVideosStore.getState().markVideosInvalid(toInvalidate);
        }
      }
    } finally {
      if (activeFetchId === fetchId) {
        set({ isLoading: false, loaded: 0, progressTotal: 0 });
      }
    }
  },

  readUserFavFolderVideos: async (mediaId, mode = 'incremental', opts) => {
    if (get().isLoading) return;
    const effectiveMode: Exclude<UserVideosFetchMode, 'default'> =
      mode === 'default' ? 'incremental' : mode;
    const fetchId = ++activeFetchId;
    set({ isLoading: true, loaded: 0, progressTotal: 0 });
    const ui = useUIStore.getState();
    const folderKey = String(mediaId);

    const fetchPage = async (
      pn: number,
    ): Promise<{ videoList: VideoListItem[]; total: number } | null> => {
      try {
        const data = await UserApi.getMyFavoriteFolderVideos({
          params: { media_id: mediaId, pn, ps: PAGE_SIZE },
        });
        if (activeFetchId !== fetchId) return null;
        const medias = (data?.medias ?? []) as VideoListItem[];
        const info = data?.info ?? {};
        const total = data?.info?.media_count ?? 0;
        set((state) => {
          const entry: FavFolderCacheEntry = {
            ...((state.favFolders[folderKey] ?? {
              ...DEFAULT_ENTRY,
              info: {},
            }) as FavFolderCacheEntry),
          };
          entry.video_list = mergeVideoList(entry.video_list, medias);
          entry.count = total;
          entry.update_time = timeStampNow();
          entry.update_type = effectiveMode;
          entry.info = info as Record<string, unknown>;
          return { favFolders: { ...state.favFolders, [folderKey]: entry } };
        });
        useBilibiliVideosStore.getState().upsertMany(pickVideosFields(medias, 'fav_folder'));
        return { videoList: medias, total };
      } catch {
        if (activeFetchId !== fetchId) return null;
        ui.sendNotice({
          type: NoticeType.ERROR,
          message: '获取收藏夹列表失败',
          duration: 3000,
        });
        return null;
      }
    };

    try {
      if (effectiveMode === 'incremental') {
        const entry = get().favFolders[folderKey] ?? { ...DEFAULT_ENTRY, info: {} };
        const localBvids = new Set(entry.video_list.map((v) => v.bvid));
        if (localBvids.size === 0) {
          for (let pn = 1; pn <= FIRST_LOAD_PAGES; pn++) {
            if (activeFetchId !== fetchId) return;
            const r = await fetchPage(pn);
            if (!r || activeFetchId !== fetchId) return;
            const localCount = get().favFolders[folderKey]?.video_list.length ?? 0;
            set({
              progressTotal: Math.min(r.total, FIRST_LOAD_PAGES * PAGE_SIZE),
              loaded: localCount,
            });
            const totalPages = Math.ceil(r.total / PAGE_SIZE);
            if (pn >= totalPages) break;
            await sleep(PAGE_SLEEP_MS);
          }
        } else {
          for (let pn = 1; pn <= INCREMENTAL_MAX_PAGES; pn++) {
            if (activeFetchId !== fetchId) return;
            const r = await fetchPage(pn);
            if (!r || activeFetchId !== fetchId) return;
            const localCount = get().favFolders[folderKey]?.video_list.length ?? 0;
            set({ progressTotal: r.total, loaded: localCount });
            const incomingNew = r.videoList.filter((v) => !localBvids.has(v.bvid));
            if (incomingNew.length === 0) break;
            if (incomingNew.length < r.videoList.length) break;
            incomingNew.forEach((v) => localBvids.add(v.bvid));
            const totalPages = Math.ceil(r.total / PAGE_SIZE);
            if (pn >= totalPages) break;
            await sleep(PAGE_SLEEP_MS);
          }
        }
      } else if (effectiveMode === 'range') {
        const fromPage = Math.max(1, opts?.fromPage ?? 1);
        const firstR = await fetchPage(fromPage);
        if (!firstR || activeFetchId !== fetchId) return;
        const totalPages = Math.ceil(firstR.total / PAGE_SIZE);
        const toPage = Math.min(opts?.toPage ?? fromPage, totalPages);
        set({
          progressTotal: (toPage - fromPage + 1) * PAGE_SIZE,
          loaded: firstR.videoList.length,
        });
        for (let pn = fromPage + 1; pn <= toPage; pn++) {
          await sleep(PAGE_SLEEP_MS);
          if (activeFetchId !== fetchId) return;
          const r = await fetchPage(pn);
          if (!r || activeFetchId !== fetchId) return;
          set((s) => ({ loaded: s.loaded + r.videoList.length }));
        }
      } else if (effectiveMode === 'fully') {
        const remoteBvids = new Set<string>();
        let pn = 1;
        let totalPages = -1;
        while (totalPages === -1 || pn <= totalPages) {
          if (activeFetchId !== fetchId) return;
          const r = await fetchPage(pn);
          if (!r || activeFetchId !== fetchId) return;
          r.videoList.forEach((v) => remoteBvids.add(v.bvid));
          totalPages = Math.ceil(r.total / PAGE_SIZE);
          set({ progressTotal: r.total, loaded: remoteBvids.size });
          if (pn >= totalPages) break;
          pn++;
          await sleep(PAGE_SLEEP_MS);
        }
        const localBvids = (get().favFolders[folderKey]?.video_list ?? []).map((v) => v.bvid);
        const toInvalidate = localBvids.filter((b) => !remoteBvids.has(b));
        if (toInvalidate.length > 0 && activeFetchId === fetchId) {
          useBilibiliVideosStore.getState().markVideosInvalid(toInvalidate);
        }
      }
    } finally {
      if (activeFetchId === fetchId) {
        set({ isLoading: false, loaded: 0, progressTotal: 0 });
      }
    }
  },

  readUserSpaceInfo: async (mid) => {
    try {
      const [info, stat, upStat] = await Promise.all([
        UserApi.getUserSpaceInfo({ params: { mid } }),
        UserApi.getUserSpaceStat({ params: { vmid: mid } }),
        UserApi.getUserSpaceUpStat({ params: { mid } }),
      ]);
      const space: BilibiliSpaceInfo = {
        ...(pick(info, BILIBILI_SPACE_INFO_FIELDS) as Partial<BilibiliSpaceInfo>),
        name: info?.name ?? '',
        mid: info?.mid ?? 0,
        face: info?.face ?? '',
        sign: info?.sign ?? '',
        sex: info?.sex ?? '',
        stats: {
          follower: stat?.follower ?? 0,
          following: stat?.following ?? 0,
          view: upStat?.archive?.view ?? 0,
          likes: upStat?.likes ?? 0,
        },
      };
      set((state) => ({ space: { ...state.space, [String(mid)]: space } }));
    } catch {
      useUIStore.getState().sendNotice({
        type: NoticeType.ERROR,
        message: '获取用户信息失败',
        duration: 3000,
      });
    }
  },

  getVideoByBvid: async (bvId, index, total) => {
    const ui = useUIStore.getState();
    ui.sendNotice({
      id: 'load_videos_tip',
      type: NoticeType.INFO,
      message: `正在读取加载投稿信息(${bvId}${index ? `,${index}/${total}` : ''})`,
      close: false,
    });
    try {
      const data = await VideoApi.getVideoViewInfo({ params: { bvid: bvId } });
      useBilibiliVideosStore
        .getState()
        .upsertMany(pickVideosFields(data as unknown as { bvid: string }, 'view'));
      return true;
    } catch {
      ui.sendNotice({
        type: NoticeType.ERROR,
        message: `获取视频(${bvId})信息失败`,
        duration: 3000,
      });
      return false;
    } finally {
      ui.removeNotice('load_videos_tip');
    }
  },

  cancelRefresh: () => {
    ++activeFetchId;
    set({ isLoading: false, loaded: 0, progressTotal: 0 });
  },

  persistSnapshot: () => {
    const { infos, space, favFolders } = get();
    return { isLoading: false, infos, space, favFolders };
  },
}));
