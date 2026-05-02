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
 * 添加到歌单弹窗。
 *
 * - fromSearch=true 时，bvid 可能尚未在 store 中，需要先调用 getVideoByBvid 拉取
 * - 仅 CUSTOM 类型歌单可被选中（其他类型由 UP 主或 B 站收藏夹自动同步）
 * - excludeFavId 用于在已属于某歌单时禁用该选项
 */
export function AddToFavDialog() {
  const open = useUIShell((s) => s.addToFavOpen);
  const close = useUIShell((s) => s.closeAddToFav);
  const bvid = useUIShell((s) => s.addToFavBvid);
  const excludeId = useUIShell((s) => s.addToFavExcludeId);
  const fromSearch = useUIShell((s) => s.addToFavFromSearch);

  const favList = useFavListStore((s) => s.list);
  const addFavVideo = useFavListStore((s) => s.addFavVideo);
  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const getVideoByBvid = useBilibiliUserVideosStore((s) => s.getVideoByBvid);
  const sendNotice = useUIStore((s) => s.sendNotice);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      return;
    }
    // fromSearch 模式下确保视频信息已在 store
    if (bvid && fromSearch && !videoEntities[bvid]) {
      setFetching(true);
      getVideoByBvid(bvid).finally(() => setFetching(false));
    }
  }, [open, bvid, fromSearch, videoEntities, getVideoByBvid]);

  const customLists = useMemo(
    () => favList.filter((f) => f.type === FavListType.CUSTOM),
    [favList],
  );
  const video = bvid ? videoEntities[bvid] : undefined;

  const toggle = (favId: string) => {
    if (favId === excludeId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(favId)) next.delete(favId);
      else next.add(favId);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!bvid || selected.size === 0) {
      close();
      return;
    }
    selected.forEach((favId) => addFavVideo(favId, bvid));
    sendNotice({
      type: NoticeType.SUCCESS,
      message: `已添加到 ${selected.size} 个歌单`,
      duration: 2000,
    });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加到歌单</DialogTitle>
          <DialogDescription className="truncate">{video?.title ?? bvid}</DialogDescription>
        </DialogHeader>

        {fetching && <p className="text-sm text-muted-foreground">加载视频信息…</p>}

        {customLists.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            暂无可添加的自定义歌单，请先创建一个
          </p>
        ) : (
          <ScrollArea className="max-h-[40vh]">
            <div className="flex flex-col gap-1">
              {customLists.map((fav) => {
                const isExcluded = fav.id === excludeId;
                const isSelected = selected.has(fav.id);
                return (
                  <button
                    key={fav.id}
                    type="button"
                    disabled={isExcluded}
                    onClick={() => toggle(fav.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                      isSelected ? 'border-primary bg-primary/10' : 'border-input',
                      isExcluded && 'cursor-not-allowed opacity-50',
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
          <Button variant="outline" onClick={close}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            确认添加
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
