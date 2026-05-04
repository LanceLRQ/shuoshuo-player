import { useEffect, useState } from 'react';
import { Plus, ExternalLink, Loader2 } from 'lucide-react';
import {
  LiveSlicerApi,
  useUIStore,
  urlPrefixFixed,
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

export function LiveSlicersPage() {
  const [slicerList, setSlicerList] = useState<LiveSlicerMan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openFavEdit = useUIShell((s) => s.openFavEdit);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    LiveSlicerApi.publicList({ page: 1, limit: 100 })
      .then((resp) => {
        if (cancelled) return;
        setSlicerList(pickCloudList<LiveSlicerMan>(resp));
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
  }, [sendNotice]);

  const handleAddToFav = (slicer: LiveSlicerMan) => {
    // 弹 FavEditDialog 预填 UPLOADER + mid + name；用户可以再编辑名字
    openFavEdit(null, {
      type: FavListType.UPLOADER,
      midInput: slicer.mid,
      name: slicer.name,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">直播切片 UP 主</h2>
        <p className="text-xs text-muted-foreground">点击"关注"创建以该 UP 主投稿为来源的歌单</p>
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
          {slicerList.map((slicer) => (
            <Card key={slicer.id} className="flex flex-col items-center gap-2 p-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={urlPrefixFixed(slicer.face)} alt={slicer.name} />
                <AvatarFallback>{slicer.name?.[0] ?? '?'}</AvatarFallback>
              </Avatar>
              <p
                className="line-clamp-1 w-full text-center text-sm font-medium"
                title={slicer.name}
              >
                {slicer.name}
              </p>
              <p
                className="line-clamp-1 w-full text-center text-[11px] text-muted-foreground"
                title={`UID: ${slicer.mid}`}
              >
                UID: {slicer.mid}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => handleAddToFav(slicer)}>
                  <Plus className="mr-1 h-3 w-3" />
                  关注
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="访问 B 站空间"
                  onClick={() =>
                    void getPlatformBridge().shell.openExternal(
                      `https://space.bilibili.com/${slicer.mid}`,
                    )
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
