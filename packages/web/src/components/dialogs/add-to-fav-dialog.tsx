import { useEffect, useMemo, useState } from 'react';
import { Music, Star, Video, ListMusic } from 'lucide-react';
import {
  useFavListStore,
  useBilibiliVideosStore,
  useBilibiliUserVideosStore,
  useUIStore,
  FavListType,
  NoticeType,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUIShell } from '@/stores/ui-shell';

/**
 * 添加到歌单弹窗（支持单条与批量两种模式）。
 *
 * - bvids.length === 1（单条）：fromSearch 模式下若视频不在 store 会预拉一次用于显示标题
 * - bvids.length > 1（批量）：不预拉，提交时由 addFavVideoByBvids 串行拉取并写入
 * - 仅 CUSTOM 类型歌单可被选中（其他类型由 UP 主或 B 站收藏夹自动同步）
 * - excludeFavId 用于在已属于某歌单时禁用该选项（仅单条场景生效）
 */
export function AddToFavDialog() {
  const open = useUIShell((s) => s.addToFavOpen);
  const close = useUIShell((s) => s.closeAddToFav);
  const bvids = useUIShell((s) => s.addToFavBvids);
  const excludeId = useUIShell((s) => s.addToFavExcludeId);
  const fromSearch = useUIShell((s) => s.addToFavFromSearch);

  const favList = useFavListStore((s) => s.list);
  const addFavVideo = useFavListStore((s) => s.addFavVideo);
  const addFavVideoByBvids = useFavListStore((s) => s.addFavVideoByBvids);
  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const getVideoByBvid = useBilibiliUserVideosStore((s) => s.getVideoByBvid);
  const sendNotice = useUIStore((s) => s.sendNotice);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBatch = bvids.length > 1;
  const singleBvid = !isBatch ? bvids[0] : undefined;

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSubmitting(false);
      return;
    }
    // 单条 + fromSearch 模式下确保视频信息已在 store（用于显示标题）
    if (singleBvid && fromSearch && !videoEntities[singleBvid]) {
      setFetching(true);
      getVideoByBvid(singleBvid).finally(() => setFetching(false));
    }
  }, [open, singleBvid, fromSearch, videoEntities, getVideoByBvid]);

  const customLists = useMemo(
    () => favList.filter((f) => f.type === FavListType.CUSTOM),
    [favList],
  );
  const singleVideo = singleBvid ? videoEntities[singleBvid] : undefined;

  const toggle = (favId: string) => {
    if (favId === excludeId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(favId)) next.delete(favId);
      else next.add(favId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (bvids.length === 0 || selected.size === 0) {
      close();
      return;
    }
    if (!isBatch) {
      // 单条：同步逐歌单写入
      selected.forEach((favId) => addFavVideo(favId, bvids[0]));
      sendNotice({
        type: NoticeType.SUCCESS,
        message: `已添加到 ${selected.size} 个歌单`,
        duration: 2000,
      });
      close();
      return;
    }
    // 批量：并发对每个目标歌单调用 addFavVideoByBvids（自带视频拉取与进度 toast）
    setSubmitting(true);
    try {
      await Promise.all(Array.from(selected).map((favId) => addFavVideoByBvids(favId, bvids)));
    } finally {
      setSubmitting(false);
      close();
    }
  };

  const titleText = isBatch ? '批量添加到歌单' : '添加到歌单';
  const descriptionText = isBatch
    ? `已选 ${bvids.length} 首歌曲`
    : (singleVideo?.title ?? singleBvid ?? '');

  return (
    <Dialog open={open} onOpenChange={(o) => (o || submitting ? null : close())}>
      <DialogContent>
        {/*
         * min-w-0：DialogContent 是 grid 容器，其子项默认 min-width: auto 会被
         * 内部超长标题撑出 max-w-lg；显式置 0 让 grid item 允许收缩，
         * 配合 DialogDescription 的 line-clamp-2 实现两行截断。
         */}
        <DialogHeader className="min-w-0">
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription className="line-clamp-2 break-words">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>

        {!isBatch && fetching && <p className="text-sm text-muted-foreground">加载视频信息…</p>}

        {customLists.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            暂无可添加的自定义歌单，请先创建一个
          </p>
        ) : (
          <ScrollArea className="max-h-[40vh]">
            <div className="flex flex-col gap-1">
              {customLists.map((fav) => {
                const isExcluded = !isBatch && fav.id === excludeId;
                const isSelected = selected.has(fav.id);
                return (
                  <button
                    key={fav.id}
                    type="button"
                    disabled={isExcluded || submitting}
                    onClick={() => toggle(fav.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                      isSelected ? 'border-primary bg-primary/10' : 'border-input',
                      (isExcluded || submitting) && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {iconForType(fav.type)}
                    <div className="flex-1 truncate">
                      <p className="truncate text-sm font-medium">{fav.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fav.bv_ids.length} 首
                      </p>
                    </div>
                    {isExcluded && <span className="text-xs text-muted-foreground">已包含</span>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 || submitting}>
            {submitting ? '添加中…' : '确认添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function iconForType(type: FavListType) {
  if (type === FavListType.UPLOADER) return <Video className="h-4 w-4" />;
  if (type === FavListType.BILI_FAV) return <Star className="h-4 w-4" />;
  if (type === FavListType.CUSTOM) return <ListMusic className="h-4 w-4" />;
  return <Music className="h-4 w-4" />;
}
