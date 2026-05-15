import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  ListPlus,
  PlayCircle,
} from 'lucide-react';
import {
  NoticeType,
  bilibiliThumbUrl,
  pickVideosFields,
  urlPrefixFixed,
  usePlayerProfileStore,
  usePlayingListStore,
  useUIStore,
  type BilibiliVideo,
  type UploaderCollection,
  type UploaderCollectionSource,
} from '@shuoshuo-player/shared';
import {
  useCollectionAllArchives,
  useCollectionArchives,
  useUploaderCollections,
} from '@/hooks/use-uploader-seasons';
import { useUIShell } from '@/stores/ui-shell';
import { SeasonCard } from '@/components/season-card';
import { VideoItem } from '@/components/video-item';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploaderSeasonsTabProps {
  mid: string;
  /** 当前所属歌单 ID，透传给 VideoItem 用于单条点击 addSingle 行为 */
  favId: string;
}

const COLLECTION_QUERY_RE = /^(season|series):(\d+)$/;

interface OpenedCollection {
  source: UploaderCollectionSource;
  id: string;
}

function parseCollectionQuery(raw: string | null): OpenedCollection | null {
  if (!raw) return null;
  const match = raw.match(COLLECTION_QUERY_RE);
  if (!match) return null;
  return { source: match[1] as UploaderCollectionSource, id: match[2] };
}

/**
 * UP 主歌单页「合集」Tab 容器：列表态 / 详情态由 URL ?collection=<source>:<id> 决定。
 *
 * 列表态拉到的 collection 数据会在详情态作为 fallback：
 * series API 详情接口本身不返回 meta，需要从列表态把 name/cover/description 透传过去
 * 才能让 header 立即显示正确标题（而不是 "加载中…"）。
 */
export function UploaderSeasonsTab({ mid, favId }: UploaderSeasonsTabProps) {
  const [params, setParams] = useSearchParams();
  const opened = parseCollectionQuery(params.get('collection'));
  const collections = useUploaderCollections(mid);

  const openedCollection = useMemo<UploaderCollection | undefined>(() => {
    if (!opened) return undefined;
    return collections.items.find((c) => c.source === opened.source && String(c.id) === opened.id);
  }, [opened, collections.items]);

  const handleOpen = useCallback(
    (collection: UploaderCollection) => {
      const next = new URLSearchParams(params);
      next.set('collection', `${collection.source}:${collection.id}`);
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const handleBack = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('collection');
    setParams(next, { replace: false });
  }, [params, setParams]);

  if (opened) {
    return (
      <SeasonDetail
        mid={mid}
        opened={opened}
        fallback={openedCollection}
        favId={favId}
        onBack={handleBack}
      />
    );
  }
  return <SeasonList state={collections} onOpen={handleOpen} />;
}

type CollectionsHookState = ReturnType<typeof useUploaderCollections>;

interface SeasonListProps {
  state: CollectionsHookState;
  onOpen: (collection: UploaderCollection) => void;
}

function SeasonList({ state, onOpen }: SeasonListProps) {
  const { items, total, page, pageSize, hasMore, isLoading, error, setPage } = state;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-destructive">
        加载合集列表失败：{error}
      </div>
    );
  }
  if (isLoading && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }
  if (!isLoading && items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <ListMusic className="h-8 w-8" />
        这位 UP 主还没有公开的合集
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="text-xs text-muted-foreground">共 {total} 个合集</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((collection) => (
          <SeasonCard
            key={`${collection.source}-${collection.id}`}
            collection={collection}
            onClick={onOpen}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          hasMore={hasMore}
          disabled={isLoading}
          onChange={setPage}
        />
      )}
    </div>
  );
}

interface SeasonDetailProps {
  mid: string;
  opened: OpenedCollection;
  /** 来自列表态的 collection 数据；series API 详情接口无 meta 时用此兜底 name/cover/description */
  fallback?: UploaderCollection;
  favId: string;
  onBack: () => void;
}

function SeasonDetail({ mid, opened, fallback, favId, onBack }: SeasonDetailProps) {
  const fallbackMeta = useMemo(
    () =>
      fallback
        ? { name: fallback.name, description: fallback.description, cover: fallback.cover }
        : undefined,
    [fallback],
  );
  const {
    name,
    description,
    cover,
    archives,
    total,
    page,
    pageSize,
    hasMore,
    isLoading,
    error,
    setPage,
  } = useCollectionArchives(mid, opened.source, opened.id, fallbackMeta);
  const allArchives = useCollectionAllArchives(mid, opened.source, opened.id);

  const setPlaylist = usePlayingListStore((s) => s.setPlaylist);
  const addSingle = usePlayingListStore((s) => s.addSingle);
  const collectionPlayBehavior = usePlayerProfileStore((s) => s.collectionPlayBehavior);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openAddToFavBatch = useUIShell((s) => s.openAddToFavBatch);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (error) {
      sendNotice({
        type: NoticeType.WARN,
        message: `加载合集失败：${error}`,
        duration: 3000,
      });
    }
  }, [error, sendNotice]);

  const visibleVideos = useMemo<BilibiliVideo[]>(
    () => pickVideosFields(archives, 'season') as BilibiliVideo[],
    [archives],
  );

  const withAllArchives = useCallback(
    async (action: (trackIds: string[]) => void, emptyMsg: string) => {
      if (allArchives.isLoading) return;
      const all = await allArchives.trigger();
      if (!all || all.length === 0) {
        if (!allArchives.error) {
          sendNotice({ type: NoticeType.WARN, message: emptyMsg, duration: 2000 });
        }
        return;
      }
      action(all.map((a) => a.bvid));
    },
    [allArchives, sendNotice],
  );

  const handlePlayAll = useCallback(() => {
    void withAllArchives((trackIds) => {
      if (collectionPlayBehavior === 'append') {
        trackIds.forEach((tid, i) => addSingle(tid, i === 0));
        sendNotice({
          type: NoticeType.SUCCESS,
          message: `已追加 ${trackIds.length} 首到队列尾部`,
          duration: 2000,
        });
      } else {
        // favId 用 'collection:<source>:<id>' 与现有 UUID/MAIN_FAV_ID/FAVORITES_FAV_ID 隔离
        setPlaylist(`collection:${opened.source}:${opened.id}`, trackIds, trackIds[0], true);
      }
    }, '合集为空，无法播放');
  }, [withAllArchives, collectionPlayBehavior, setPlaylist, addSingle, sendNotice, opened]);

  const handleAddAll = useCallback(() => {
    void withAllArchives((trackIds) => openAddToFavBatch(trackIds), '合集为空，无法加入歌单');
  }, [withAllArchives, openAddToFavBatch]);

  const playAllLabel = useMemo(() => {
    if (allArchives.isLoading) {
      return allArchives.total > 0
        ? `加载中 ${allArchives.loaded}/${allArchives.total}`
        : '加载中…';
    }
    return '以合集为歌单播放';
  }, [allArchives.isLoading, allArchives.loaded, allArchives.total]);

  // 优先级：详情接口 → fallback meta → 视频列表首帧；总数同理用 fallback.total 兜底
  const headerCover = cover || archives[0]?.pic || '';
  const headerName = name || (archives.length === 0 ? '加载中…' : '');
  const headerTotal = total || fallback?.total || archives.length;

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/*
       * 紧凑型 header：返回箭头 + 小封面 + 标题 + 数量 + 两个操作按钮全部塞进一行。
       * description 折叠到标题的 title 属性（hover tooltip），避免占用纵向空间。
       */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 shrink-0"
          aria-label="返回合集列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
          {headerCover ? (
            <img
              src={bilibiliThumbUrl(urlPrefixFixed(headerCover), 80, 80)}
              alt={headerName}
              className="h-full w-full object-cover"
            />
          ) : (
            <ListMusic className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold leading-tight"
            title={description || headerName}
          >
            {headerName}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{headerTotal} 首</p>
        </div>
        <Button
          size="sm"
          onClick={handlePlayAll}
          disabled={allArchives.isLoading}
          className="shrink-0"
        >
          <PlayCircle className="mr-1 h-4 w-4" />
          {playAllLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddAll}
          disabled={allArchives.isLoading}
          className="shrink-0"
        >
          <ListPlus className="mr-1 h-4 w-4" />
          加入歌单
        </Button>
      </div>

      {isLoading && archives.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
          加载中…
        </div>
      ) : archives.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
          合集是空的
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-md border p-2">
          {visibleVideos.map((video) => (
            <VideoItem
              key={video.bvid}
              video={video}
              favId={favId}
              fullCreateTime
              showAddBtn
              showAddToPlayBtn
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          hasMore={hasMore}
          disabled={isLoading}
          onChange={setPage}
        />
      )}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  hasMore: boolean;
  disabled?: boolean;
  onChange: (next: number) => void;
}

function Pagination({ page, totalPages, hasMore, disabled, onChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
        上一页
      </Button>
      <span className="px-2 text-xs text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={disabled || !hasMore}
        aria-label="下一页"
      >
        下一页
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
