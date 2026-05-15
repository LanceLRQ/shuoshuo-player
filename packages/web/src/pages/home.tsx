import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import {
  MASTER_UP_INFO,
  VIDEO_LIST_REFRESH_THRESHOLD,
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  usePlayingListStore,
  timeStampNow,
  urlPrefixFixed,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { VideoItem } from '@/components/video-item';
import { Carousel } from '@/components/carousel';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { MediaLoadingDialog } from '@/components/dialogs/media-loading-dialog';
import { useUIShell } from '@/stores/ui-shell';

const MASTER_MID = String(MASTER_UP_INFO.mid);
/** 首页主歌单的虚拟 favId（与 v1 'main' 对齐） */
const MAIN_FAV_ID = 'main';

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
  const openConfirm = useUIShell((s) => s.openConfirm);

  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  // 取列表前 30 条对应的 BilibiliVideo（按 created 倒序）
  const latestVideos = useMemo<BilibiliVideo[]>(() => {
    const list = videoListInfo?.video_list ?? [];
    return list
      .slice(0, 30)
      .map((it) => videoEntities[it.bvid])
      .filter((v): v is BilibiliVideo => Boolean(v));
  }, [videoListInfo, videoEntities]);

  // 顶部轮播：最新 5 条（按 created 倒序）
  const carouselSlides = useMemo(() => latestVideos.slice(0, 5), [latestVideos]);

  // 自动 24h 更新（首次进入或上次更新超过阈值）
  useEffect(() => {
    const info = videoListInfo;
    const stale = !info || timeStampNow() - info.update_time > VIDEO_LIST_REFRESH_THRESHOLD;
    if (stale) {
      // 统一走增量模式：缓存空时 hook 内部 fallback 拉前 3 页（90 条），
      // 避免对大投稿 UP 一次性全拉触发风控
      void readUserVideos(MASTER_MID, 'incremental');
    }
    if (!spaceInfo) {
      void readUserSpaceInfo(MASTER_MID);
    }
    // 仅依赖 store 引用，不在 update_time 变化时重复触发
  }, []);

  const handleSlideClick = (video: BilibiliVideo) => {
    // 点击轮播图：替换播放队列为最近 30 条并立即播放当前曲
    const trackIds = latestVideos.map((v) => v.bvid);
    setPlaylist(MAIN_FAV_ID, trackIds, video.bvid, true);
  };

  const handleManualUpdate = (mode: 'incremental' | 'fully') => {
    setUpdateDialogOpen(false);
    if (mode === 'fully') {
      openConfirm({
        title: '重新拉取全部',
        description:
          '将串行拉取所有页（每页间隔 300ms），耗时较长且对 B 站请求量较大。完成后远端不存在的视频会标记为「已失效」。仅在数据明显异常时使用。',
        destructive: true,
        confirmText: '继续',
        onConfirm: () => void readUserVideos(MASTER_MID, 'fully'),
      });
      return;
    }
    void readUserVideos(MASTER_MID, mode);
  };

  return (
    <div className="space-y-6">
      {/* 顶部轮播图（最新 5 条） */}
      {carouselSlides.length > 0 && (
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
      )}

      {/* 标题 + 刷新按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">最新投稿</h2>
          {spaceInfo?.name && <p className="text-xs text-muted-foreground">{spaceInfo.name}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => setUpdateDialogOpen(true)}
        >
          {isLoading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          更新列表
        </Button>
      </div>

      {/* 最近 30 条 */}
      {latestVideos.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {isLoading ? '正在拉取最新投稿…' : '暂无视频，请点击"更新列表"'}
        </div>
      ) : (
        <div className="space-y-1">
          {latestVideos.map((video) => (
            <VideoItem key={video.bvid} video={video} favId={MAIN_FAV_ID} showAuthor />
          ))}
        </div>
      )}

      {/* 更新模式选择弹窗 */}
      <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>更新视频列表</AlertDialogTitle>
            <AlertDialogDescription>
              选择更新模式。重新拉取全部会串行扫描所有历史投稿，耗时较长且对 B 站请求量较大。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => handleManualUpdate('incremental')}>
              检查更新
            </Button>
            <Button variant="outline" onClick={() => handleManualUpdate('fully')}>
              重新拉取全部
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
