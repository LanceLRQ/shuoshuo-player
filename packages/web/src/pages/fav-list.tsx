import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
  usePlayerProfileStore,
  usePlayingListStore,
  useUIStore,
  selectSortedBvids,
  parseTrackId,
  NoticeType,
  type BilibiliVideo,
  type FavListItem,
  type FavoritesOrder,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { VideoItem } from '@/components/video-item';
import { ViewModeToggle } from '@/components/view-mode-toggle';
import { VideoThumbnailGrid, type ThumbnailGridItem } from '@/components/video-thumbnail-grid';
import { FavCard } from '@/components/fav-card';
import { UploaderSeasonsTab } from '@/components/uploader-seasons-tab';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
  const [searchParams, setSearchParams] = useSearchParams();

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

  const favViewMode = usePlayerProfileStore((s) => s.favViewMode);
  const setFavViewMode = usePlayerProfileStore((s) => s.setFavViewMode);
  const currentTrackId = usePlayingListStore((s) => s.current);

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

  /**
   * 歌单条目元组：trackId + 解析出的 bvid/explicitPage + 关联 video entity
   *
   * CUSTOM / favorites 的 trackId 可能含 :p<n>，store 按 bvid 索引 entity，
   * 因此需 parseTrackId 拆出 bvid 查表后保留 explicitPage 给 VideoItem 渲染角标。
   * UPLOADER / BILI_FAV 的条目永远是纯 bvid（写入侧已校验拦截）。
   */
  type FavRow = { trackId: string; video: BilibiliVideo; explicitPage?: number };
  const favVideoList = useMemo<FavRow[]>(() => {
    if (!favListInfo) return [];
    const mapTrackId = (trackId: string): FavRow | null => {
      const parsed = parseTrackId(trackId);
      const bvid = parsed?.bvid ?? trackId;
      const video = videoEntities[bvid];
      if (!video) return null;
      return { trackId, video, explicitPage: parsed?.page };
    };
    if (isFavoritesPage) {
      return selectSortedBvids(favoritesEntries, favoritesOrder)
        .map(mapTrackId)
        .filter((r): r is FavRow => r !== null);
    }
    if (favListInfo.type === FavListType.UPLOADER) {
      const entry = userVideoInfos[favListInfo.mid ?? ''];
      if (!entry) return [];
      return entry.video_list
        .map((it) => mapTrackId(it.bvid))
        .filter((r): r is FavRow => r !== null);
    }
    if (favListInfo.type === FavListType.BILI_FAV) {
      const entry = favFolderInfos[favListInfo.biliFavFolderId ?? ''];
      if (!entry) return [];
      return entry.video_list
        .map((it) => mapTrackId(it.bvid))
        .filter((r): r is FavRow => r !== null);
    }
    return favListInfo.bv_ids.map(mapTrackId).filter((r): r is FavRow => r !== null);
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
  // 注：keys 走嵌套字段 video.title，与新 FavRow 形态对齐
  const fuse = useMemo(
    () =>
      new Fuse(favVideoList, {
        keys: ['video.title', 'video.author', 'video.sub_title', 'video.description'],
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

  // 缩略图网格条目（保留 trackId 与 explicitPage：CUSTOM/favorites 条目可能含 :p<n>）
  const thumbnailItems = useMemo<ThumbnailGridItem[]>(
    () =>
      filteredVideos.map((r) => ({
        video: r.video,
        trackId: r.trackId,
        explicitPage: r.explicitPage,
      })),
    [filteredVideos],
  );

  // 点击缩略图：复用 VideoItem 同款语义——favId 存在时 addSingle 加载整张歌单并播放该条
  const handleThumbnailClick = useCallback((item: ThumbnailGridItem) => {
    usePlayingListStore.getState().addSingle(item.trackId, true);
  }, []);

  const handleRemoveSong = (trackId: string) => {
    if (!isTypeCustom) return;
    const isFav = isFavoritesPage;
    openConfirm({
      title: isFav ? '取消收藏' : '移除歌曲',
      description: isFav ? '确定从我的收藏中移除这首歌吗？' : '确定从歌单中移除这首歌吗？',
      destructive: true,
      onConfirm: () => {
        if (isFav) {
          useFavoritesStore.getState().remove(trackId);
        } else {
          removeFavVideo(favId, trackId);
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

  /* "视频投稿"区块（搜索栏 + 列表/空态），单独抽取以便 UPLOADER 类型嵌入 Tab、其他类型直接渲染 */
  const videosSection: ReactNode = (
    <>
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
          <ViewModeToggle value={favViewMode} onChange={setFavViewMode} />
          {searchKey && (
            <span className="text-xs text-muted-foreground">
              命中 {filteredVideos.length} / {favVideoList.length}
            </span>
          )}
        </div>
      )}
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
      ) : favViewMode === 'thumbnail' ? (
        <VideoThumbnailGrid
          items={thumbnailItems}
          currentTrackId={currentTrackId}
          onItemClick={handleThumbnailClick}
          onItemRemove={isTypeCustom ? (item) => handleRemoveSong(item.trackId) : undefined}
        />
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
              const row = filteredVideos[virtualRow.index];
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
                      video={row.video}
                      explicitPage={row.explicitPage}
                      favId={favId}
                      fullCreateTime
                      showAuthor={isTypeCustom}
                      showRemoveBtn={isTypeCustom}
                      onRemove={() => handleRemoveSong(row.trackId)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  /* UPLOADER 类型且有 mid 时启用 Tabs；其他类型保持原结构（零回归） */
  const uploaderMid =
    favListInfo.type === FavListType.UPLOADER && favListInfo.mid ? favListInfo.mid : null;
  const rawTab = searchParams.get('tab');
  const tab: 'videos' | 'seasons' = rawTab === 'seasons' ? 'seasons' : 'videos';
  const handleTabChange = (next: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'seasons') {
      nextParams.set('tab', 'seasons');
    } else {
      nextParams.delete('tab');
      // 切回视频投稿时也清掉详情态的 season 参数，避免再次切到合集 Tab 残留旧详情
      nextParams.delete('season');
    }
    setSearchParams(nextParams, { replace: false });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <FavCard favId={favId} fav={favListInfo} />
      {uploaderMid ? (
        // min-h-0：让 flex item 允许收缩超出 content 大小，否则虚拟列表的 overflow-auto 失效
        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="videos">视频投稿</TabsTrigger>
            <TabsTrigger value="seasons">合集</TabsTrigger>
          </TabsList>
          {/*
           * forceMount 让两个 Tab 内容常驻 DOM（仅由 CSS hidden 控制显隐）。
           * 默认行为下 Radix Tabs.Content 在 inactive 时会 unmount，导致：
           *   1) 视频投稿 Tab 的 useVirtualizer parentRef 失效，切回后白屏
           *   2) 合集 Tab 切回需重新拉数据并丢掉详情态滚动位置
           */}
          <TabsContent
            value="videos"
            forceMount
            className="mt-0 flex min-h-0 flex-1 flex-col gap-4 data-[state=inactive]:hidden"
          >
            {videosSection}
          </TabsContent>
          <TabsContent
            value="seasons"
            forceMount
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <UploaderSeasonsTab mid={uploaderMid} favId={favId} />
          </TabsContent>
        </Tabs>
      ) : (
        videosSection
      )}
    </div>
  );
}
