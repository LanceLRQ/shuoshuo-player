import { useEffect, useMemo, useState } from 'react';
import { Heart, Star, Video } from 'lucide-react';
import { FavListType, type ImportSummary, type MergeMode } from '@shuoshuo-player/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { APP_VERSION, IS_BETA_VERSION } from '@/lib/version';

interface ImportDataDialogProps {
  open: boolean;
  summary: ImportSummary | null;
  onCancel: () => void;
  onConfirm: (mode: MergeMode, selectedFavIds: Set<string>) => void;
}

const MODE_OPTIONS: ReadonlyArray<{ value: MergeMode; label: string; hint: string }> = [
  {
    value: 'skip',
    label: '跳过同名',
    hint: '已存在同 ID 的歌单不动，仅追加新增',
  },
  {
    value: 'replace',
    label: '覆盖同名',
    hint: '同 ID 自定义歌单用导入版本替换；B 站收藏夹/UP 主类不动',
  },
];

function favTypeLabel(type: FavListType): string {
  switch (type) {
    case FavListType.UPLOADER:
      return 'UP 主';
    case FavListType.BILI_FAV:
      return 'B 站收藏夹';
    case FavListType.CUSTOM:
    default:
      return '自定义';
  }
}

function FavTypeIcon({ type }: { type: FavListType }) {
  if (type === FavListType.UPLOADER) return <Video className="h-3.5 w-3.5" />;
  if (type === FavListType.BILI_FAV) return <Star className="h-3.5 w-3.5" />;
  return <Heart className="h-3.5 w-3.5" />;
}

export function ImportDataDialog({ open, summary, onCancel, onConfirm }: ImportDataDialogProps) {
  const [mode, setMode] = useState<MergeMode>('skip');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 弹窗每次打开（summary 变化）重置默认状态：mode=skip + 全选
  useEffect(() => {
    if (open && summary) {
      setMode('skip');
      setSelected(new Set(summary.favList.map((it) => it.id)));
    }
  }, [open, summary]);

  const totalFav = summary?.favList.length ?? 0;

  const allSelected = useMemo(() => {
    if (totalFav === 0) return false;
    return selected.size === totalFav;
  }, [selected.size, totalFav]);

  const handleToggleAll = () => {
    if (!summary) return;
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(summary.favList.map((it) => it.id)));
    }
  };

  const handleToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!summary) return;
    onConfirm(mode, selected);
  };

  if (!summary) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onCancel())}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-3 overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle>导入数据预览</DialogTitle>
          <DialogDescription className="text-xs">
            仅导入歌单、歌词与视频元数据；当前的播放队列、播放器设置等不会被改动。
          </DialogDescription>
        </DialogHeader>

        {/* 摘要区：4 列单行 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">版本</span>
            <Badge
              variant={summary.version === '1' ? 'secondary' : 'default'}
              className="text-[10px]"
            >
              {summary.version === '1' ? 'v1（旧版）' : 'v2'}
            </Badge>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">歌单</span>
            <span className="font-medium">{totalFav}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">歌词</span>
            <span className="font-medium">{summary.lyricCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">视频</span>
            <span className="font-medium">{summary.videoCount}</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
            v{APP_VERSION}
            {IS_BETA_VERSION && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] uppercase tracking-wide"
              >
                Beta
              </Badge>
            )}
          </span>
        </div>

        {/* 合并模式：紧凑单行布局，hint 走 title 悬浮 */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">合并模式</p>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as MergeMode)} className="gap-1">
            {MODE_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`merge-mode-${opt.value}`} />
                <Label
                  htmlFor={`merge-mode-${opt.value}`}
                  className="flex items-baseline gap-2"
                  title={opt.hint}
                >
                  <span className="text-sm">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.hint}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        {/* 歌单列表 */}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">我的歌单</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                已选 <span className="font-medium text-foreground">{selected.size}</span> /{' '}
                {totalFav}
              </span>
              <Button variant="ghost" size="sm" onClick={handleToggleAll} disabled={totalFav === 0}>
                {allSelected ? '取消全选' : '全选'}
              </Button>
            </div>
          </div>

          {totalFav === 0 ? (
            <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              文件中不含任何歌单
            </p>
          ) : (
            <ScrollArea className="max-h-48 min-h-0 flex-1 rounded-md border">
              <ul className="divide-y">
                {summary.favList.map((fav) => {
                  const isCustom = fav.type === FavListType.CUSTOM;
                  const checked = selected.has(fav.id);
                  return (
                    <li key={fav.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggle(fav.id)}
                        aria-label={`选择歌单 ${fav.name}`}
                      />
                      <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[11px]">
                        <FavTypeIcon type={fav.type} />
                        {favTypeLabel(fav.type)}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate">{fav.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {isCustom ? `${fav.bv_ids.length} 首` : '请手动更新内容'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <p className="text-[11px] leading-tight text-muted-foreground">
          导入后，B 站收藏夹 / UP 主类歌单需要进入对应歌单手动更新一次内容。
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0 && totalFav > 0}>
            确定导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
