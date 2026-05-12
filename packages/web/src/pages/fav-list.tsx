import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import Fuse from 'fuse.js';
import {
  Search,
  X,
  AlertCircle,
  FolderOpen,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
} from 'lucide-react';
import {
  MASTER_UP_INFO,
  FavListType,
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  useFavListStore,
  useFavoritesStore,
  useUIStore,
  selectSortedBvids,
  NoticeType,
  type BilibiliVideo,
  type FavListItem,
  type FavoritesOrder,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { VideoItem } from '@/components/video-item';
import { FavCard } from '@/components/fav-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const MAIN_FAV_ID = 'main';
const FAVORITES_FAV_ID = 'favorites';
const MASTER_MID = String(MASTER_UP_INFO.mid);
const ROW_HEIGHT = 108;

/** 主歌单虚拟条目（与 v1 'main' 行为对齐） */
const MAIN_FAV_ITEM: FavListItem = {
  id: MAIN_FAV_ID,
  name: `${MASTER_UP_INFO.uname}的歌单`,
  type: FavListType.UPLOADER,
  mid: MASTER_MID,
  bv_ids: [],
  create_time: 0,
  update_time: 0,
};

/** 系统级「我的收藏」虚拟条目：复用 CUSTOM 渲染路径，bv_ids 由 favorites store 派生 */
const FAVORITES_FAV_ITEM: FavListItem = {
  id: FAVORITES_FAV_ID,
  name: '我的收藏',
  type: FavListType.CUSTOM,
  bv_ids: [],
  create_time: 0,
  update_time: 0,
};

export function FavListPage() {
  const params = useParams<{ id: string }>();
  const favId = params.id ?? MAIN_FAV_ID;

  const [searchKey, setSearchKey] = useState('');
  const [favoritesOrder, setFavoritesOrder] = useState<FavoritesOrder>('desc');
  const parentRef = useRef<HTMLDivElement>(null);

  const favList = useFavListStore((s) => s.list);
  const removeFavVideo = useFavListStore((s) => s.removeFavVideo);

  const favoritesEntries = useFavoritesStore((s) => s.entries);

  const userVideoInfos = useBilibiliUserVideosStore((s) => s.infos);
  const favFolderInfos = useBilibiliUserVideosStore((s) => s.favFolders);
  const videoEntities = useBilibiliVideosStore((s) => s.entities);

  const sendNotice = useUIStore((s) => s.sendNotice);
  const openConfirm = useUIShell((s) => s.openConfirm);

  // 切换 favId 时清空搜索框
  useEffect(() => {
    setSearchKey('');
  }, [favId]);

  const isFavoritesPage = favId === FAVORITES_FAV_ID;

  const favListInfo = useMemo<FavListItem | null>(() => {
    if (favId === MAIN_FAV_ID) return MAIN_FAV_ITEM;
    if (favId === FAVORITES_FAV_ID) return FAVORITES_FAV_ITEM;
    return favList.find((f) => f.id === favId) ?? null;
  }, [favId, favList]);

  const isTypeCustom = favListInfo?.type === FavListType.CUSTOM;

  // 根据类型计算视频列表
  const favVideoList = useMemo<BilibiliVideo[]>(() => {
    if (!favListInfo) return [];
    // 我的收藏：bv_ids 由 favorites store 派生，按当前排序模式
    if (isFavoritesPage) {
      return selectSortedBvids(favoritesEntries, favoritesOrder)
        .map((bvid) => videoEntities[bvid])
        .filter((v): v is BilibiliVideo => Boolean(v));
    }
    if (favListInfo.type === FavListType.UPLOADER) {
      const mid = favListInfo.mid ?? '';
      const entry = userVideoInfos[mid];
      if (!entry) return [];
      return entry.video_list
        .map((it) => videoEntities[it.bvid])
        .filter((v): v is BilibiliVideo => Boolean(v));
    }
    if (favListInfo.type === FavListType.BILI_FAV) {
      const folderId = favListInfo.biliFavFolderId ?? '';
      const entry = favFolderInfos[folderId];
      if (!entry) return [];
      return entry.video_list
        .map((it) => videoEntities[it.bvid])
        .filter((v): v is BilibiliVideo => Boolean(v));
    }
    // CUSTOM
    return favListInfo.bv_ids
      .map((bvid) => videoEntities[bvid])
      .filter((v): v is BilibiliVideo => Boolean(v));
  }, [
    favListInfo,
    isFavoritesPage,
    favoritesEntries,
    favoritesOrder,
    userVideoInfos,
    favFolderInfos,
    videoEntities,
  ]);

  // Fuse.js 多字段搜索（v1 仅 title；v2 扩为 title/author/sub_title/description）
  const fuse = useMemo(
    () =>
      new Fuse(favVideoList, {
        keys: ['title', 'author', 'sub_title', 'description'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [favVideoList],
  );

  const filteredVideos = useMemo(() => {
    if (!searchKey.trim()) return favVideoList;
    return fuse.search(searchKey).map((r) => r.item);
  }, [fuse, searchKey, favVideoList]);

  // 虚拟列表
  const virtualizer = useVirtualizer({
    count: filteredVideos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const handleRemoveSong = (bvid: string) => {
    if (!isTypeCustom) return;
    const isFav = isFavoritesPage;
    openConfirm({
      title: isFav ? '取消收藏' : '移除歌曲',
      description: isFav ? '确定从我的收藏中移除这首歌吗？' : '确定从歌单中移除这首歌吗？',
      destructive: true,
      onConfirm: () => {
        if (isFav) {
          useFavoritesStore.getState().remove(bvid);
        } else {
          removeFavVideo(favId, bvid);
        }
        sendNotice({ type: NoticeType.SUCCESS, message: '已移除', duration: 2000 });
      },
    });
  };

  if (!favListInfo) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <AlertCircle className="mr-2 h-4 w-4" />
        歌单不存在或已被删除
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 顶部 FavCard */}
      <FavCard favId={favId} fav={favListInfo} />

      {/* 搜索栏 */}
      {favVideoList.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索歌曲（标题 / 作者 / 简介）"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="pl-9"
            />
            {searchKey && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearchKey('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {isFavoritesPage && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1"
              onClick={() => setFavoritesOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            >
              {favoritesOrder === 'desc' ? (
                <ArrowDownNarrowWide className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
              )}
              {favoritesOrder === 'desc' ? '最新收藏在前' : '最早收藏在前'}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {filteredVideos.length} / {favVideoList.length}
          </span>
        </div>
      )}

      {/* 列表 */}
      {filteredVideos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          {searchKey ? (
            <>
              <AlertCircle className="h-6 w-6" />
              没有找到关键词为"{searchKey}"的结果
            </>
          ) : (
            <>
              <FolderOpen className="h-6 w-6" />
              {favVideoList.length === 0 ? '歌单是空的' : '没有可显示的视频'}
            </>
          )}
        </div>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto rounded-md border"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const video = filteredVideos[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="px-2 py-1">
                    <VideoItem
                      video={video}
                      favId={favId}
                      fullCreateTime
                      showAuthor={isTypeCustom}
                      showRemoveBtn={isTypeCustom}
                      onRemove={handleRemoveSong}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
