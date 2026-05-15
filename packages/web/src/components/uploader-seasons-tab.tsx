import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
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
  type BilibiliSeasonVideo,
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
import { MediaLoadingDialog } from '@/components/dialogs/media-loading-dialog';
import { PageRangeDialog } from '@/components/dialogs/page-range-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/* ───────── 批次配置 ───────── */

/** 与 hook 内 ARCHIVES_PAGE_SIZE 对齐；分散在两边因为模块边界——若需统一可抽公共常量 */
const ARCHIVES_PAGE_SIZE = 30;
/** 一批 5 页 = 150 首；超过此数才启用分批 DropdownMenu，否则保持单按钮 */
const BATCH_PAGE_COUNT = 5;
const BATCH_SIZE_VIDEOS = BATCH_PAGE_COUNT * ARCHIVES_PAGE_SIZE; // 150

interface Batch {
  fromPage: number;
  toPage: number;
  /** 例：「第 1-7 页（最新约 200 首）」/「第 8-14 页（约 200 首）」 */
  label: string;
}

/**
 * 把合集切成 200 一组的批次；total ≤ 200 时返回空数组（调用方按单按钮分支处理）。
 *
 * 每批最多 7 页 × 30 = 210 条；末批向 total 截断。
 * label 用页码语言表达（与投稿/收藏夹的"按范围拉取"对话框一致），更直观。
 */
function computeBatches(total: number): Batch[] {
  if (total <= BATCH_SIZE_VIDEOS) return [];
  const lastPage = Math.ceil(total / ARCHIVES_PAGE_SIZE);
  const count = Math.ceil(total / BATCH_SIZE_VIDEOS);
  const result: Batch[] = [];
  for (let i = 0; i < count; i++) {
    const fromPage = i * BATCH_PAGE_COUNT + 1;
    const toPage = Math.min((i + 1) * BATCH_PAGE_COUNT, lastPage);
    const approxCount = (toPage - fromPage + 1) * ARCHIVES_PAGE_SIZE;
    const label =
      i === 0
        ? `第 ${fromPage}-${toPage} 页（最新约 ${approxCount} 首）`
        : `第 ${fromPage}-${toPage} 页（约 ${approxCount} 首）`;
    result.push({ fromPage, toPage, label });
  }
  return result;
}

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
  const openConfirm = useUIShell((s) => s.openConfirm);

  /**
   * 累积用户分页过程中浏览过的所有视频。
   * useCollectionArchives 是替换式分页，翻页后 archives 只有当前页 30 条；
   * 这里用 bvid → archive 的 Map 去重累积，让「加入歌单」能拿到翻过的全部页。
   * mid/source/id 变化时重置。
   */
  const [visitedArchives, setVisitedArchives] = useState<Map<string, BilibiliSeasonVideo>>(
    () => new Map(),
  );
  useEffect(() => {
    setVisitedArchives(new Map());
  }, [mid, opened.source, opened.id]);
  useEffect(() => {
    if (archives.length === 0) return;
    setVisitedArchives((prev) => {
      const next = new Map(prev);
      archives.forEach((a) => next.set(a.bvid, a));
      return next.size === prev.size ? prev : next;
    });
  }, [archives]);

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

  /**
   * 全量拉取的公共流程：防重入 + 触发 trigger + 空集合兜底通知。
   * 接受可选 range 参数透传给 trigger，未传则拉全部。
   */
  const withAllArchives = useCallback(
    async (
      action: (trackIds: string[]) => void,
      emptyMsg: string,
      range?: { fromPage: number; toPage: number },
    ) => {
      if (allArchives.isLoading) return;
      const all = await allArchives.trigger(range);
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

  /** 播放某个范围（用于分批 DropdownMenu 和单按钮分支共享） */
  const playRange = useCallback(
    (range?: { fromPage: number; toPage: number }) => {
      void withAllArchives(
        (trackIds) => {
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
        },
        '合集为空，无法播放',
        range,
      );
    },
    [withAllArchives, collectionPlayBehavior, setPlaylist, addSingle, sendNotice, opened],
  );

  const handlePlayAll = useCallback(() => playRange(undefined), [playRange]);

  // 优先级：详情接口 → fallback meta → 视频列表首帧；总数同理用 fallback.total 兜底
  const headerCover = cover || archives[0]?.pic || '';
  const headerName = name || (archives.length === 0 ? '加载中…' : '');
  const headerTotal = total || fallback?.total || archives.length;

  const batches = useMemo(() => computeBatches(headerTotal), [headerTotal]);
  const useBatchedDropdown = batches.length > 0;
  const collectionTotalPages = Math.max(1, Math.ceil(headerTotal / ARCHIVES_PAGE_SIZE));
  /** PageRangeDialog 复用：mode 区分"播放范围"/"加入歌单范围" */
  const [rangeDialog, setRangeDialog] = useState<{ open: boolean; mode: 'play' | 'add' }>({
    open: false,
    mode: 'play',
  });

  /** 「全部加载」选项点击后弹 destructive 确认（仅在大合集 DropdownMenu 中暴露） */
  const handlePlayAllWithConfirm = useCallback(() => {
    openConfirm({
      title: `加载全部 ${headerTotal} 首？`,
      description: `每页之间会留 200ms 间隔，预计 ${Math.ceil((headerTotal / ARCHIVES_PAGE_SIZE) * 0.25)} 秒。期间可随时取消；为避免被风控，请勿频繁触发。`,
      destructive: true,
      confirmText: '继续加载',
      onConfirm: () => playRange(undefined),
    });
  }, [openConfirm, headerTotal, playRange]);

  /**
   * 「加入歌单」按钮主体行为：用本地已加载的视频（visited + allArchives 并集），
   * 不发起新请求。dropdown 内才提供"按范围拉取后加入"的选项。
   */
  const handleAddCurrentLoaded = useCallback(() => {
    const merged = new Map<string, BilibiliSeasonVideo>(visitedArchives);
    allArchives.archives.forEach((a) => merged.set(a.bvid, a));
    if (merged.size === 0) {
      sendNotice({
        type: NoticeType.WARN,
        message: '当前没有可加入歌单的视频',
        duration: 2000,
      });
      return;
    }
    openAddToFavBatch(Array.from(merged.values()).map((a) => a.bvid));
  }, [allArchives.archives, visitedArchives, openAddToFavBatch, sendNotice]);

  /** 拉取指定范围 → 拉完后用结果加入歌单（dropdown 范围项 + 自定义范围项共用） */
  const handleAddRange = useCallback(
    (fromPage: number, toPage: number) => {
      void withAllArchives((trackIds) => openAddToFavBatch(trackIds), '该范围内没有可加入的视频', {
        fromPage,
        toPage,
      });
    },
    [withAllArchives, openAddToFavBatch],
  );

  /** 「全部加入歌单」destructive 确认 → 拉全部 → 加入歌单 */
  const handleAddAllConfirm = useCallback(() => {
    openConfirm({
      title: `加载全部 ${headerTotal} 首到歌单？`,
      description: `每页之间会留 200ms 间隔，预计 ${Math.ceil((headerTotal / ARCHIVES_PAGE_SIZE) * 0.25)} 秒。期间可随时取消；为避免被风控，请勿频繁触发。`,
      destructive: true,
      confirmText: '继续加载',
      onConfirm: () =>
        void withAllArchives((trackIds) => openAddToFavBatch(trackIds), '合集为空', undefined),
    });
  }, [openConfirm, headerTotal, withAllArchives, openAddToFavBatch]);

  const handleRangeConfirm = useCallback(
    (fromPage: number, toPage: number) => {
      const mode = rangeDialog.mode;
      setRangeDialog((s) => ({ ...s, open: false }));
      if (mode === 'add') {
        handleAddRange(fromPage, toPage);
      } else {
        void playRange({ fromPage, toPage });
      }
    },
    [rangeDialog.mode, handleAddRange, playRange],
  );

  const playAllLabel = useMemo(() => {
    if (allArchives.isLoading) {
      return allArchives.total > 0
        ? `加载中 ${allArchives.loaded}/${allArchives.total}`
        : '加载中…';
    }
    return '以合集为歌单播放';
  }, [allArchives.isLoading, allArchives.loaded, allArchives.total]);

  /** 按钮标签显示"已加载数量"：批量拉取与分页累积的去重总数（用 Set 算 bvid 并集） */
  const addToFavLoadedCount = useMemo(() => {
    if (visitedArchives.size === 0 && allArchives.archives.length === 0) return 0;
    const seen = new Set<string>(visitedArchives.keys());
    allArchives.archives.forEach((a) => seen.add(a.bvid));
    return seen.size;
  }, [visitedArchives, allArchives.archives]);
  const addToFavLabel =
    addToFavLoadedCount > 0 ? `加入歌单（${addToFavLoadedCount} 首已加载）` : '加入歌单';

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
        {useBatchedDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={allArchives.isLoading} className="shrink-0">
                <PlayCircle className="mr-1 h-4 w-4" />
                {playAllLabel}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {batches.map((b) => (
                <DropdownMenuItem
                  key={`${b.fromPage}-${b.toPage}`}
                  onSelect={() => playRange({ fromPage: b.fromPage, toPage: b.toPage })}
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {b.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => setRangeDialog({ open: true, mode: 'play' })}>
                <PlayCircle className="mr-2 h-4 w-4" />
                自定义范围…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handlePlayAllWithConfirm}
                className="text-destructive focus:text-destructive"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                全部 {headerTotal} 首（高风险）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            size="sm"
            onClick={handlePlayAll}
            disabled={allArchives.isLoading}
            className="shrink-0"
          >
            <PlayCircle className="mr-1 h-4 w-4" />
            {playAllLabel}
          </Button>
        )}
        {useBatchedDropdown ? (
          // Split button：主按钮直接「加入当前已加载」；右侧 ▾ 展开范围选择
          <div className="inline-flex shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddCurrentLoaded}
              disabled={allArchives.isLoading}
              className="rounded-r-none border-r-0"
            >
              <ListPlus className="mr-1 h-4 w-4" />
              {addToFavLabel}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={allArchives.isLoading}
                  className="rounded-l-none px-2"
                  aria-label="加入歌单更多选项"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {batches.map((b) => (
                  <DropdownMenuItem
                    key={`add-${b.fromPage}-${b.toPage}`}
                    onSelect={() => handleAddRange(b.fromPage, b.toPage)}
                  >
                    <ListPlus className="mr-2 h-4 w-4" />
                    加入 {b.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => setRangeDialog({ open: true, mode: 'add' })}>
                  <ListPlus className="mr-2 h-4 w-4" />
                  自定义范围…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleAddAllConfirm}
                  className="text-destructive focus:text-destructive"
                >
                  <ListPlus className="mr-2 h-4 w-4" />
                  全部 {headerTotal} 首（高风险）
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddCurrentLoaded}
            disabled={allArchives.isLoading}
            className="shrink-0"
          >
            <ListPlus className="mr-1 h-4 w-4" />
            {addToFavLabel}
          </Button>
        )}
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
        <>
          <Pagination
            page={page}
            totalPages={totalPages}
            hasMore={hasMore}
            disabled={isLoading}
            onChange={setPage}
          />
          <p className="text-center text-xs text-muted-foreground">
            此处仅供浏览；批量播放 / 加入歌单请用上方按钮
          </p>
        </>
      )}

      <MediaLoadingDialog
        loading={allArchives.isLoading}
        loaded={allArchives.loaded}
        total={allArchives.total}
        onCancel={allArchives.cancel}
        title="正在加载合集…"
      />
      <PageRangeDialog
        open={rangeDialog.open}
        totalPages={collectionTotalPages}
        pageSize={ARCHIVES_PAGE_SIZE}
        title={rangeDialog.mode === 'add' ? '按范围加入歌单' : '按范围播放合集'}
        onConfirm={handleRangeConfirm}
        onCancel={() => setRangeDialog((s) => ({ ...s, open: false }))}
      />
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
