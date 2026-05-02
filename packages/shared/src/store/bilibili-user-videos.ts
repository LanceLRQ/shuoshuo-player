import { create } from 'zustand';
import { pick } from 'lodash-es';
import type { BilibiliSpaceInfo, VideoListCacheEntry, FavFolderCacheEntry } from '../types';
import { BILIBILI_VIDEO_LIST_FIELDS, BILIBILI_SPACE_INFO_FIELDS, NoticeType } from '../constants';
import { UserApi, VideoApi } from '../api';
import { useBilibiliVideosStore } from './bilibili-videos';
import { useUIStore } from './ui';
import { timeStampNow } from '../utils';

type VideoListItem = { bvid: string; created: number };

interface BilibiliUserVideosState {
  isLoading: boolean;
  /** mid → 投稿视频列表缓存 */
  infos: Record<string, VideoListCacheEntry>;
  /** mid → 空间信息（含 stats） */
  space: Record<string, BilibiliSpaceInfo>;
  /** folder_id → 收藏夹缓存 */
  favFolders: Record<string, FavFolderCacheEntry>;

  readUserVideos: (mid: string | number, mode?: 'default' | 'fully') => Promise<void>;
  readUserFavFolderVideos: (mediaId: string | number, mode?: 'default' | 'fully') => Promise<void>;
  readUserSpaceInfo: (mid: string | number) => Promise<void>;
  getVideoByBvid: (bvId: string, index?: number, total?: number) => Promise<boolean>;

  /** 持久化前清理 isLoading（对应 v1 persistFunc） */
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

/** 内部辅助：合并新数据到现有 video_list（重复则更新，否则追加），然后按 created 倒序 */
function mergeVideoList(current: VideoListItem[], incoming: VideoListItem[]): VideoListItem[] {
  const next = [...current];
  for (const v of incoming) {
    const picked = pick(v, BILIBILI_VIDEO_LIST_FIELDS) as VideoListItem;
    const idx = next.findIndex((it) => it.bvid === picked.bvid);
    if (idx >= 0) next[idx] = picked;
    else next.push(picked);
  }
  return next.sort((a, b) => (a.created > b.created ? -1 : 1));
}

export const useBilibiliUserVideosStore = create<BilibiliUserVideosState>((set, get) => ({
  isLoading: false,
  infos: {},
  space: {},
  favFolders: {},

  readUserVideos: async (mid, mode = 'default') => {
    set({ isLoading: true });
    const ui = useUIStore.getState();
    ui.sendNotice({
      id: 'load_user_videos_tip',
      type: NoticeType.INFO,
      message: '正在加载投稿列表',
      close: false,
    });

    const fetchPage = async (pn = 1, ps = 30): Promise<number> => {
      try {
        const data = await UserApi.getUserVideoList({ params: { mid, pn, ps } });
        const videoList = (data?.list?.vlist ?? []) as VideoListItem[];
        const total = data?.page?.count ?? 0;

        set((state) => {
          const entry: VideoListCacheEntry = {
            ...(state.infos[String(mid)] ?? DEFAULT_ENTRY),
          };
          entry.video_list = mergeVideoList(entry.video_list, videoList);
          entry.count = total;
          entry.update_time = timeStampNow();
          entry.update_type = mode;
          return { infos: { ...state.infos, [String(mid)]: entry } };
        });

        useBilibiliVideosStore
          .getState()
          .upsertMany(videoList.map((v) => pick(v, BILIBILI_VIDEO_LIST_FIELDS) as VideoListItem));
        return total;
      } catch {
        ui.sendNotice({
          type: NoticeType.ERROR,
          message: '获取用户信息失败',
          duration: 3000,
        });
        return 0;
      }
    };

    if (mode === 'fully') {
      let pn = 1;
      const ps = 30;
      let total = -1;
      let pp = -1;
      while (total === -1 || pn <= pp) {
        total = await fetchPage(pn, ps);
        pp = Math.ceil(total / ps);
        pn++;
        await new Promise((r) => setTimeout(r, 300));
        ui.sendNotice({
          id: 'load_user_videos_tip',
          type: NoticeType.INFO,
          message: `正在加载投稿列表(${pn}/${pp})`,
          close: false,
        });
      }
    } else {
      await fetchPage();
    }

    ui.removeNotice('load_user_videos_tip');
    ui.sendNotice({ type: NoticeType.SUCCESS, message: '更新完成', duration: 3000 });
    set({ isLoading: false });
  },

  readUserFavFolderVideos: async (mediaId, mode = 'default') => {
    set({ isLoading: true });
    const ui = useUIStore.getState();
    ui.sendNotice({
      id: 'load_fav_folder_videos_tip',
      type: NoticeType.INFO,
      message: '正在加载用户收藏夹列表',
      close: false,
    });

    const fetchPage = async (pn = 1, ps = 30): Promise<number> => {
      try {
        const data = await UserApi.getMyFavoriteFolderVideos({
          params: { media_id: mediaId, pn, ps },
        });
        const medias = (data?.medias ?? []) as VideoListItem[];
        const info = data?.info ?? {};
        const total = data?.info?.media_count ?? 0;

        set((state) => {
          const entry: FavFolderCacheEntry = {
            ...((state.favFolders[String(mediaId)] ?? {
              ...DEFAULT_ENTRY,
              info: {},
            }) as FavFolderCacheEntry),
          };
          entry.video_list = mergeVideoList(entry.video_list, medias);
          entry.count = total;
          entry.update_time = timeStampNow();
          entry.update_type = mode;
          entry.info = info as Record<string, unknown>;
          return { favFolders: { ...state.favFolders, [String(mediaId)]: entry } };
        });

        useBilibiliVideosStore
          .getState()
          .upsertMany(medias.map((v) => pick(v, BILIBILI_VIDEO_LIST_FIELDS) as VideoListItem));
        return total;
      } catch {
        ui.sendNotice({
          type: NoticeType.ERROR,
          message: '获取收藏夹列表失败',
          duration: 3000,
        });
        return 0;
      }
    };

    if (mode === 'fully') {
      let pn = 1;
      const ps = 30;
      let total = -1;
      let pp = -1;
      while (total === -1 || pn <= pp) {
        total = await fetchPage(pn, ps);
        pp = Math.ceil(total / ps);
        pn++;
        await new Promise((r) => setTimeout(r, 300));
        ui.sendNotice({
          id: 'load_fav_folder_videos_tip',
          type: NoticeType.INFO,
          message: `正在加载用户收藏夹列表(${pn}/${pp})`,
          close: false,
        });
      }
    } else {
      await fetchPage();
    }

    ui.removeNotice('load_fav_folder_videos_tip');
    ui.sendNotice({ type: NoticeType.SUCCESS, message: '更新完成', duration: 3000 });
    set({ isLoading: false });
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
      useBilibiliVideosStore.getState().upsertMany([data]);
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

  persistSnapshot: () => {
    const { infos, space, favFolders } = get();
    return { isLoading: false, infos, space, favFolders };
  },
}));
