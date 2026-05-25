import { useCallback, useMemo } from 'react';
import {
  usePlayingListStore,
  useUIStore,
  useFavoritesStore,
  useVideoPagePrefStore,
  buildTrackId,
  getPlatformBridge,
  NoticeType,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';

export interface VideoItemPart {
  key: string | number;
  page: number;
  part?: string;
}

export interface VideoItemActions {
  effectiveTrackId: string;
  isFavored: boolean;
  /** 多 P 投稿且未锁定显式 P（分 P 相关操作的渲染条件） */
  isMultiPart: boolean;
  partItems: VideoItemPart[];
  defaultPage: number;
  toggleLike: () => void;
  addToPlay: () => void;
  addToFav: () => void;
  openPagesPicker: () => void;
  pinDefaultPage: (page: number) => void;
  openBilibili: () => void;
}

/**
 * 视频条目操作集（收藏 / 稍后播放 / 添加歌单 / 分 P / 去 B 站）。
 *
 * 抽出供缩略图右键菜单复用，逻辑与 VideoItem 内对应 handler 对齐（含 toast 文案与失效拦截）。
 * VideoItem 暂未迁移到本 hook，两处逻辑短期并存——这是为隔离核心列表组件的回归风险，
 * 后续可让 VideoItem 复用本 hook 消除重复。
 */
export function useVideoItemActions(video: BilibiliVideo, explicitPage?: number): VideoItemActions {
  const addSingle = usePlayingListStore((s) => s.addSingle);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const setDefaultPage = useVideoPagePrefStore((s) => s.setDefaultPage);
  const openPagesPickerStore = useUIShell((s) => s.openPagesPicker);
  const openAddToFavStore = useUIShell((s) => s.openAddToFav);

  const effectiveTrackId = useMemo(
    () => buildTrackId(video.bvid, explicitPage),
    [video.bvid, explicitPage],
  );
  const isFavored = useFavoritesStore((s) => effectiveTrackId in s.entries);
  const defaultPage = useVideoPagePrefStore((s) => s.defaultPage[video.bvid] ?? 1);

  const totalP = video.videos ?? 1;
  const isMultiPart = totalP > 1 && explicitPage === undefined;
  const partItems = useMemo<VideoItemPart[]>(() => {
    if (video.pages && video.pages.length > 0) {
      return video.pages.map((p) => ({ key: p.cid, page: p.page, part: p.part }));
    }
    return Array.from({ length: totalP }, (_, i) => ({ key: i + 1, page: i + 1 }));
  }, [video.pages, totalP]);

  const isInvalid = video.invalid === true;

  const toggleLike = useCallback(() => {
    const nextFavored = toggleFavorite(effectiveTrackId);
    sendNotice({
      type: NoticeType.SUCCESS,
      message: nextFavored ? '已添加到我的收藏' : '已从我的收藏移除',
      duration: 2000,
    });
  }, [toggleFavorite, sendNotice, effectiveTrackId]);

  const addToPlay = useCallback(() => {
    if (isInvalid) {
      sendNotice({
        type: NoticeType.WARN,
        message: '该视频已被作者删除或不可访问',
        duration: 2500,
      });
      return;
    }
    addSingle(effectiveTrackId, false);
    sendNotice({ type: NoticeType.SUCCESS, message: '添加成功', duration: 2000 });
  }, [isInvalid, addSingle, sendNotice, effectiveTrackId]);

  const addToFav = useCallback(() => {
    openAddToFavStore(effectiveTrackId, { fromSearch: false });
  }, [openAddToFavStore, effectiveTrackId]);

  const openPagesPicker = useCallback(() => {
    openPagesPickerStore(video);
  }, [openPagesPickerStore, video]);

  const pinDefaultPage = useCallback(
    (page: number) => {
      setDefaultPage(video.bvid, page);
      sendNotice({
        type: NoticeType.SUCCESS,
        message: page <= 1 ? '已清除默认 P 设置' : `已设默认 P${page}`,
        duration: 2000,
      });
    },
    [setDefaultPage, sendNotice, video.bvid],
  );

  const openBilibili = useCallback(() => {
    void getPlatformBridge().shell.openExternal(`https://www.bilibili.com/video/${video.bvid}`);
  }, [video.bvid]);

  return {
    effectiveTrackId,
    isFavored,
    isMultiPart,
    partItems,
    defaultPage,
    toggleLike,
    addToPlay,
    addToFav,
    openPagesPicker,
    pinDefaultPage,
    openBilibili,
  };
}
