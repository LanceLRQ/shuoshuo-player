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

interface ImportDataDialogProps {
  open: boolean;
  summary: ImportSummary | null;
  onCancel: () => void;
  onConfirm: (mode: MergeMode, selectedFavIds: Set<string>) => void;
}

const MODE_OPTIONS: ReadonlyArray<{ value: MergeMode; label: string; hint: string }> = [
  { value: 'append', label: '仅追加新增项', hint: '保留当前数据，仅添加导入文件中新出现的歌单' },
  {
    value: 'replaceAndAppend',
    label: '替换已有 + 追加新增',
    hint: '同 ID 歌单用导入版本覆盖，未出现在导入中的当前歌单保留',
  },
  {
    value: 'overwrite',
    label: '完全覆盖',
    hint: '清空当前所有"我的歌单"，再写入导入文件中的全部歌单',
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
  const [mode, setMode] = useState<MergeMode>('append');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 弹窗每次打开（summary 变化）重置默认状态：mode=append + 全选
  useEffect(() => {
    if (open && summary) {
      setMode('append');
      setSelected(new Set(summary.favList.map((it) => it.id)));
    }
  }, [open, summary]);

  const isOverwrite = mode === 'overwrite';
  const totalFav = summary?.favList.length ?? 0;
  // overwrite 模式下逻辑上"全部强制选中"
  const effectiveSelectedCount = isOverwrite ? totalFav : selected.size;

  const allSelected = useMemo(() => {
    if (totalFav === 0) return false;
    return effectiveSelectedCount === totalFav;
  }, [effectiveSelectedCount, totalFav]);

  const handleToggleAll = () => {
    if (isOverwrite || !summary) return;
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(summary.favList.map((it) => it.id)));
    }
  };

  const handleToggle = (id: string) => {
    if (isOverwrite) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!summary) return;
    // overwrite 模式传全部 id（buildMerged 内部会忽略，但语义清晰）
    const finalSelected = isOverwrite ? new Set(summary.favList.map((it) => it.id)) : selected;
    onConfirm(mode, finalSelected);
  };

  if (!summary) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onCancel())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>导入数据预览</DialogTitle>
          <DialogDescription>
            选择要导入的歌单与合并模式。playing_list / ui_profile / 视频缓存不会被导入。
          </DialogDescription>
        </DialogHeader>

        {/* 摘要区 */}
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">文件版本</span>
            <Badge variant={summary.version === '1' ? 'secondary' : 'default'}>
              {summary.version === '1' ? 'v1（旧版）' : 'v2'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">歌单总数</span>
            <span className="font-medium">{totalFav}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">歌词条目</span>
            <span className="font-medium">{summary.lyricCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">播放器版本</span>
            <span className="font-medium">v{__APP_VERSION__}</span>
          </div>
        </div>

        {/* 合并模式 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">合并模式</p>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as MergeMode)} className="gap-2">
            {MODE_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-start gap-2">
                <RadioGroupItem
                  value={opt.value}
                  id={`merge-mode-${opt.value}`}
                  className="mt-0.5"
                />
                <Label htmlFor={`merge-mode-${opt.value}`} className="flex flex-col gap-0.5">
                  <span className="text-sm">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.hint}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        {/* 歌单列表 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">我的歌单</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                已选 <span className="font-medium text-foreground">{effectiveSelectedCount}</span> /{' '}
                {totalFav}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                disabled={isOverwrite || totalFav === 0}
              >
                {allSelected ? '取消全选' : '全选'}
              </Button>
            </div>
          </div>

          {totalFav === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
              文件中不含任何歌单
            </p>
          ) : (
            <ScrollArea className="h-64 rounded-md border">
              <ul className="divide-y">
                {summary.favList.map((fav) => {
                  const isCustom = fav.type === FavListType.CUSTOM;
                  const checked = isOverwrite || selected.has(fav.id);
                  return (
                    <li key={fav.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggle(fav.id)}
                        disabled={isOverwrite}
                        aria-label={`选择歌单 ${fav.name}`}
                      />
                      <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[11px]">
                        <FavTypeIcon type={fav.type} />
                        {favTypeLabel(fav.type)}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate">{fav.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {isCustom ? `${fav.bv_ids.length} 首` : '-- 首（导入后请刷新）'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          B 站收藏夹 / UP 主类歌单的视频列表导入后需在侧边栏进入对应歌单触发"刷新"才能看到内容。
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isOverwrite && effectiveSelectedCount === 0 && totalFav > 0}
          >
            确定导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
