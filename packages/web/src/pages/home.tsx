import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RefreshCw, Loader2, ChevronDown, Sliders, AlertTriangle } from 'lucide-react';
import {
  MASTER_UP_INFO,
  VIDEO_LIST_REFRESH_THRESHOLD,
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  usePlayingListStore,
  useUIStore,
  timeStampNow,
  urlPrefixFixed,
  NoticeType,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { VideoItem } from '@/components/video-item';
import { Carousel } from '@/components/carousel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MediaLoadingDialog } from '@/components/dialogs/media-loading-dialog';
import { PageRangeDialog } from '@/components/dialogs/page-range-dialog';
import { useUIShell } from '@/stores/ui-shell';

const MASTER_MID = String(MASTER_UP_INFO.mid);
/** 首页主歌单的虚拟 favId（与 v1 'main' 对齐） */
const MAIN_FAV_ID = 'main';
const PAGE_SIZE = 30;
/** VideoItem 单行紧凑布局行高（含 px-2 py-1 padding） */
const ROW_HEIGHT = 56;

export function HomePage() {
  const videoListInfo = useBilibiliUserVideosStore((s) => s.infos[MASTER_MID]);
  const spaceInfo = useBilibiliUserVideosStore((s) => s.space[MASTER_MID]);
  const isLoading = useBilibiliUserVideosStore((s) => s.isLoading);
  const readUserVideos = useBilibiliUserVideosStore((s) => s.readUserVideos);
  const readUserSpaceInfo = useBilibiliUserVideosStore((s) => s.readUserSpaceInfo);

  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const setPlaylist = usePlayingListStore((s) => s.setPlaylist);
  const loaded = useBilibiliUserVideosStore((s) => s.loaded);
  const progressTotal = useBilibiliUserVideosStore((s) => s.progressTotal);
  const cancelRefresh = useBilibiliUserVideosStore((s) => s.cancelRefresh);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openConfirm = useUIShell((s) => s.openConfirm);

  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  // 全量视频（按 created 倒序，过滤掉 store 中没有 entity 的 bvid）
  const allVideos = useMemo<BilibiliVideo[]>(() => {
    const list = videoListInfo?.video_list ?? [];
    return list.map((it) => videoEntities[it.bvid]).filter((v): v is BilibiliVideo => Boolean(v));
  }, [videoListInfo, videoEntities]);

  // 顶部轮播：最新 5 条（按 created 倒序）
  const carouselSlides = useMemo(() => allVideos.slice(0, 5), [allVideos]);

  // 范围拉取所需总页数（B 站接口 count 字段）
  const sourceTotal = videoListInfo?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(sourceTotal / PAGE_SIZE));

  // 自动 24h 更新（首次进入或上次更新超过阈值）
  useEffect(() => {
    const info = videoListInfo;
    const stale = !info || timeStampNow() - info.update_time > VIDEO_LIST_REFRESH_THRESHOLD;
    if (stale) {
      // 统一走增量模式：缓存空时 hook 内部 fallback 拉前 3 页（90 条），
      // 避免对大投稿 UP 一次性全拉触发风控。
      // incremental 模式 store 默认会发开始/结束 toast，避免后台静默无反馈。
      void readUserVideos(MASTER_MID, 'incremental');
    }
    if (!spaceInfo) {
      void readUserSpaceInfo(MASTER_MID);
    }
    // 仅依赖 store 引用，不在 update_time 变化时重复触发
  }, []);

  // 虚拟滚动（全量投稿可能上千条）
  const virtualizer = useVirtualizer({
    count: allVideos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const handleSlideClick = (video: BilibiliVideo) => {
    // 点击轮播图：替换播放队列为全量投稿并立即播放当前曲
    const trackIds = allVideos.map((v) => v.bvid);
    setPlaylist(MAIN_FAV_ID, trackIds, video.bvid, true);
  };

  const handleOpenRangeDialog = useCallback(() => {
    if (sourceTotal === 0) {
      sendNotice({
        type: NoticeType.WARN,
        message: '尚未拿到总条数，请先点「检查更新」获取',
        duration: 2500,
      });
      return;
    }
    setRangeDialogOpen(true);
  }, [sourceTotal, sendNotice]);

  const handleRangeConfirm = useCallback(
    (fromPage: number, toPage: number) => {
      setRangeDialogOpen(false);
      void readUserVideos(MASTER_MID, 'range', { fromPage, toPage });
    },
    [readUserVideos],
  );

  const handleFullyReload = useCallback(() => {
    openConfirm({
      title: '重新拉取全部',
      description:
        '将串行拉取所有页（每页间隔 300ms），耗时较长且对 B 站请求量较大。完成后远端不存在的视频会标记为「已失效」。仅在数据明显异常时使用。',
      destructive: true,
      confirmText: '继续',
      onConfirm: () => void readUserVideos(MASTER_MID, 'fully'),
    });
  }, [openConfirm, readUserVideos]);

  return (
    <div className="flex h-full flex-col gap-6">
      {/* 顶部轮播图（最新 5 条） */}
      {carouselSlides.length > 0 && (
        <div className="shrink-0">
          <Carousel
            slides={carouselSlides}
            autoplayDelay={4000}
            loop
            onSlideClick={handleSlideClick}
            renderSlide={(video) => (
              <div className="relative h-56 w-full overflow-hidden rounded-md sm:h-64">
                <img
                  src={urlPrefixFixed(video.pic)}
                  alt={video.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="line-clamp-1 text-base font-medium text-white">{video.title}</p>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* 标题 + split button（主键直点 incremental，▾ 展开范围/全部） */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">最新投稿</h2>
          {spaceInfo?.name && <p className="text-xs text-muted-foreground">{spaceInfo.name}</p>}
        </div>
        <div className="inline-flex shrink-0">
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={() => void readUserVideos(MASTER_MID, 'incremental')}
            className="rounded-r-none border-r-0"
          >
            {isLoading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            检查更新
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading}
                className="rounded-l-none px-2"
                aria-label="更多刷新选项"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem
                onSelect={() => void readUserVideos(MASTER_MID, 'incremental')}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                检查更新
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleOpenRangeDialog} disabled={isLoading}>
                <Sliders className="mr-2 h-4 w-4" />
                按范围拉取…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleFullyReload}
                disabled={isLoading}
                className="text-destructive focus:text-destructive"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                重新拉取全部
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 视频列表区：全量虚拟滚动；列表区独占剩余高度，顶部轮播+标题保持固定 */}
      {allVideos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {isLoading ? '正在拉取最新投稿…' : '暂无视频，请点击「检查更新」'}
        </div>
      ) : (
        <div
          ref={parentRef}
          className="min-h-0 flex-1 overflow-auto rounded-md border"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((vr) => {
              const video = allVideos[vr.index];
              return (
                <div
                  key={vr.key}
                  data-index={vr.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  <div className="px-2 py-1">
                    <VideoItem video={video} favId={MAIN_FAV_ID} showAuthor />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PageRangeDialog
        open={rangeDialogOpen}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        title="按范围拉取"
        onConfirm={handleRangeConfirm}
        onCancel={() => setRangeDialogOpen(false)}
      />

      <MediaLoadingDialog
        loading={isLoading}
        loaded={loaded}
        total={progressTotal}
        onCancel={cancelRefresh}
        title="正在加载投稿…"
        unit="条"
      />
    </div>
  );
}
