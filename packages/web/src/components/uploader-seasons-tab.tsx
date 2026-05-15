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
} from '@shuoshuo-player/shared';
import {
  useSeasonAllArchives,
  useSeasonArchives,
  useUploaderSeasons,
} from '@/hooks/use-uploader-seasons';
import { useUIShell } from '@/stores/ui-shell';
import { SeasonCard } from '@/components/season-card';
import { VideoItem } from '@/components/video-item';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploaderSeasonsTabProps {
  /** UP 主 UID（字符串） */
  mid: string;
  /** 当前所属歌单 ID，透传给 VideoItem 用于单条点击 addSingle 行为 */
  favId: string;
}

/**
 * UP 主歌单页「合集」Tab 容器。
 *
 * 两态切换通过 URL query `?season=<id>` 反映：
 * - 列表态（season 缺失）：渲染合集卡片网格
 * - 详情态（season 命中）：渲染合集 header + 视频分页列表
 *
 * 浏览器后退键 / 「返回合集列表」按钮都从 URL 移除 season 参数即可回到列表态。
 */
export function UploaderSeasonsTab({ mid, favId }: UploaderSeasonsTabProps) {
  const [params, setParams] = useSearchParams();
  const seasonIdRaw = params.get('season');
  const seasonId = seasonIdRaw && /^\d+$/.test(seasonIdRaw) ? seasonIdRaw : null;

  const handleOpen = useCallback(
    (sid: number) => {
      const next = new URLSearchParams(params);
      next.set('season', String(sid));
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const handleBack = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('season');
    setParams(next, { replace: false });
  }, [params, setParams]);

  if (seasonId) {
    return <SeasonDetail mid={mid} seasonId={seasonId} favId={favId} onBack={handleBack} />;
  }
  return <SeasonList mid={mid} onOpen={handleOpen} />;
}

interface SeasonListProps {
  mid: string;
  onOpen: (seasonId: number) => void;
}

function SeasonList({ mid, onOpen }: SeasonListProps) {
  const { items, total, page, pageSize, hasMore, isLoading, error, setPage } =
    useUploaderSeasons(mid);

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

  if (!isLoading && total === 0) {
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
        {items.map((season) => (
          <SeasonCard key={season.meta.season_id} season={season} onClick={onOpen} />
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
  seasonId: string;
  favId: string;
  onBack: () => void;
}

function SeasonDetail({ mid, seasonId, favId, onBack }: SeasonDetailProps) {
  const { meta, archives, total, page, pageSize, hasMore, isLoading, error, setPage } =
    useSeasonArchives(mid, seasonId);
  const allArchives = useSeasonAllArchives(mid, seasonId);

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

  /** 视频列表当前页归一化映射；archives 不变时复用，避免逐 render 重建对象 */
  const visibleVideos = useMemo<BilibiliVideo[]>(
    () => pickVideosFields(archives, 'season') as BilibiliVideo[],
    [archives],
  );

  /**
   * 抽出"触发全量拉取 + 空集合兜底通知"的公共片段；
   * 已在拉取中（isLoading）则丢弃本次点击，防止用户连点导致重复全量请求。
   */
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
        // favId 用 'season:' 前缀与现有 UUID/MAIN_FAV_ID/FAVORITES_FAV_ID 命名空间隔离
        setPlaylist(`season:${mid}:${seasonId}`, trackIds, trackIds[0], true);
      }
    }, '合集为空，无法播放');
  }, [withAllArchives, collectionPlayBehavior, setPlaylist, addSingle, sendNotice, mid, seasonId]);

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

  const headerCover = meta?.cover || archives[0]?.pic || '';

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回合集列表
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row">
        <div
          className={cn(
            'flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted sm:w-32',
          )}
        >
          {headerCover ? (
            <img
              src={bilibiliThumbUrl(urlPrefixFixed(headerCover), 400, 400)}
              alt={meta?.name ?? ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <ListMusic className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-lg font-semibold" title={meta?.name ?? ''}>
              {meta?.name ?? '加载中…'}
            </h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {meta?.total ?? total} 首
            </span>
          </div>
          {meta?.description && (
            <p className="line-clamp-3 text-xs text-muted-foreground" title={meta.description}>
              {meta.description}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button onClick={handlePlayAll} disabled={allArchives.isLoading}>
              <PlayCircle className="mr-2 h-4 w-4" />
              {playAllLabel}
            </Button>
            <Button variant="outline" onClick={handleAddAll} disabled={allArchives.isLoading}>
              <ListPlus className="mr-2 h-4 w-4" />
              全部加入歌单…
            </Button>
          </div>
        </div>
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
