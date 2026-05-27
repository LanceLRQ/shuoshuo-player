import { useEffect, useMemo, useState } from 'react';
import { Plus, ExternalLink, Loader2 } from 'lucide-react';
import {
  LiveSlicerApi,
  useUIStore,
  useLiveSlicerCacheStore,
  urlPrefixFixed,
  formatNumber10K,
  NoticeType,
  FavListType,
  getPlatformBridge,
  pickCloudList,
  type LiveSlicerMan,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SORT_OPTIONS = [
  { value: 'updated', label: '最近更新' },
  { value: 'follower', label: '粉丝数' },
  { value: 'archive', label: '投稿数' },
] as const;
type SortBy = (typeof SORT_OPTIONS)[number]['value'];

export function LiveSlicersPage() {
  const [slicerList, setSlicerList] = useState<LiveSlicerMan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openFavEdit = useUIShell((s) => s.openFavEdit);
  const entries = useLiveSlicerCacheStore((s) => s.entries);
  const refreshSlicers = useLiveSlicerCacheStore((s) => s.refreshSlicers);
  const markRead = useLiveSlicerCacheStore((s) => s.markRead);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    LiveSlicerApi.publicList({ page: 1, limit: 100 })
      .then((resp) => {
        if (cancelled) return;
        const list = pickCloudList<LiveSlicerMan>(resp, {
          entityKey: 'live_slicer_man',
          resultKey: 'live_slicer_men',
        });
        setSlicerList(list);
        // 后台静默补充粉丝/投稿数（限并发 + 间隔 + 24h 缓存），不阻塞列表渲染
        void refreshSlicers(list);
      })
      .catch(() => {
        if (cancelled) return;
        sendNotice({
          type: NoticeType.ERROR,
          message: '获取切片 UP 主列表失败',
          duration: 3000,
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sendNotice, refreshSlicers]);

  // slicer join 缓存条目，按选定维度降序；未缓存的排序值视为 0（排末尾）
  const sortedList = useMemo(() => {
    const sortValue = (slicer: LiveSlicerMan): number => {
      const entry = entries[slicer.mid];
      if (!entry) return 0;
      if (sortBy === 'follower') return entry.follower;
      if (sortBy === 'archive') return entry.archiveCount;
      return entry.lastUpdatedAt;
    };
    return [...slicerList].sort((a, b) => sortValue(b) - sortValue(a));
  }, [slicerList, entries, sortBy]);

  const handleAddToFav = (slicer: LiveSlicerMan) => {
    markRead(slicer.mid);
    // 弹 FavEditDialog 预填 UPLOADER + mid + name；用户可以再编辑名字
    openFavEdit(null, {
      type: FavListType.UPLOADER,
      midInput: slicer.mid,
      name: slicer.name,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">直播切片 UP 主</h2>
          <p className="text-xs text-muted-foreground">点击"关注"创建以该 UP 主投稿为来源的歌单</p>
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-28" aria-label="排序方式">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && slicerList.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在拉取切片列表…
        </div>
      ) : slicerList.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          暂无切片 UP 主
        </div>
      ) : (
        // 用 auto-fill + minmax 替代断点列数：Card 至少 180px 才装得下 18 位 UID，否则被截为纯省略号
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {sortedList.map((slicer) => {
            const entry = entries[slicer.mid];
            const displayName = entry?.name || slicer.name;
            const displayFace = entry?.face || slicer.face;
            return (
              <Card key={slicer.id} className="relative flex flex-col items-center gap-2 p-4">
                {entry?.hasUnread && (
                  <Badge
                    variant="destructive"
                    className="absolute right-1 top-1 cursor-pointer px-1.5 py-0 text-[10px]"
                    title={`新增 ${entry.lastDelta} 个投稿，点击标记已读`}
                    onClick={() => markRead(slicer.mid)}
                  >
                    +{entry.lastDelta}
                  </Badge>
                )}
                <Avatar className="h-16 w-16">
                  <AvatarImage src={urlPrefixFixed(displayFace)} alt={displayName} />
                  <AvatarFallback>{displayName?.[0] ?? '?'}</AvatarFallback>
                </Avatar>
                <p
                  className="line-clamp-1 w-full text-center text-sm font-medium"
                  title={displayName}
                >
                  {displayName}
                </p>
                <p
                  className="line-clamp-1 w-full text-center text-[11px] text-muted-foreground"
                  title={`UID: ${slicer.mid}`}
                >
                  UID: {slicer.mid}
                </p>
                {entry && (
                  <p className="line-clamp-1 w-full text-center text-[11px] text-muted-foreground">
                    粉丝 {formatNumber10K(entry.follower)} · 投稿 {entry.archiveCount}
                  </p>
                )}
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleAddToFav(slicer)}>
                    <Plus className="mr-1 h-3 w-3" />
                    关注
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="访问 B 站空间"
                    onClick={() => {
                      markRead(slicer.mid);
                      void getPlatformBridge().shell.openExternal(
                        `https://space.bilibili.com/${slicer.mid}`,
                      );
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
