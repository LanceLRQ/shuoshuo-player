import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Music, Star, Video, ListMusic, Plus } from 'lucide-react';
import {
  useFavListStore,
  useBilibiliVideosStore,
  useBilibiliUserVideosStore,
  usePlayingListStore,
  useUIStore,
  parseTrackId,
  buildTrackId,
  trackIdToBvid,
  FavListType,
  NoticeType,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { usePlayerRuntimeStore } from '@/stores/player-runtime';

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
  const addFavList = useFavListStore((s) => s.addFavList);
  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const getVideoByBvid = useBilibiliUserVideosStore((s) => s.getVideoByBvid);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const currentTrackId = usePlayingListStore((s) => s.current);
  const playingPage = usePlayerRuntimeStore((s) => s.playingPage);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 单条 + 多 P 模式下的添加模式：整投稿 | 指定 P */
  const [partMode, setPartMode] = useState<'video' | 'page'>('video');
  /** 快速新建歌单：是否处于「展开输入框」态 */
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const isBatch = bvids.length > 1;
  // 单条入参可能是 trackId（含 :p<n>），解析出 bvid 与 explicitPage
  const singleTrackId = !isBatch ? bvids[0] : undefined;
  const singleParsed = useMemo(
    () => (singleTrackId ? parseTrackId(singleTrackId) : null),
    [singleTrackId],
  );
  const singleBvid =
    singleParsed?.bvid ?? (singleTrackId ? trackIdToBvid(singleTrackId) : undefined);
  const explicitPage = singleParsed?.page;

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSubmitting(false);
      setPartMode('video');
      setCreating(false);
      setNewName('');
      setCreateError(null);
      return;
    }
    // 单条 + fromSearch 模式下确保视频信息已在 store（用于显示标题）
    if (singleBvid && fromSearch && !videoEntities[singleBvid]) {
      setFetching(true);
      getVideoByBvid(singleBvid).finally(() => setFetching(false));
    }
    // 入参含 :p<n> → 默认选"指定 P"模式；否则默认整投稿
    setPartMode(explicitPage !== undefined ? 'page' : 'video');
  }, [open, singleBvid, fromSearch, videoEntities, getVideoByBvid, explicitPage]);

  const customLists = useMemo(
    () => favList.filter((f) => f.type === FavListType.CUSTOM),
    [favList],
  );
  const singleVideo = singleBvid ? videoEntities[singleBvid] : undefined;

  // 决定"指定 P"模式下使用哪个 P：
  // - 入参显式 :p<n> → 用 n
  // - 否则用当前正在播放的 P（仅当 video 是当前播放投稿；fallback P1）
  const isCurrentlyPlaying =
    singleBvid !== undefined && trackIdToBvid(currentTrackId) === singleBvid;
  const targetPage = explicitPage ?? (isCurrentlyPlaying ? playingPage : 1);
  const targetPagePart = singleVideo?.pages?.[targetPage - 1]?.part;
  const isMultiPart = (singleVideo?.videos ?? 1) > 1;
  /** 是否显示"整投稿 / 指定 P"二选项 */
  const showPartModeRadio = !isBatch && isMultiPart && targetPage >= 2;

  /**
   * 计算单条模式下实际要写入的 TrackId（与 handleConfirm 内逻辑同步），
   * 用于"目标歌单已包含该 TrackId 时禁用"的检测。
   */
  const writeTrackIdForSingle = useMemo(() => {
    if (isBatch || !singleBvid) return undefined;
    return showPartModeRadio && partMode === 'page'
      ? buildTrackId(singleBvid, targetPage)
      : singleBvid;
  }, [isBatch, singleBvid, showPartModeRadio, partMode, targetPage]);

  const toggle = (favId: string) => {
    if (favId === excludeId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(favId)) next.delete(favId);
      else next.add(favId);
      return next;
    });
  };

  const cancelCreate = () => {
    setCreating(false);
    setNewName('');
    setCreateError(null);
  };

  const handleQuickCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError('请输入歌单名称');
      return;
    }
    // 与 FavEditDialog 的 zod schema 对齐：长度上限 40
    if (trimmed.length > 40) {
      setCreateError('名称过长（最多 40 字符）');
      return;
    }
    const created = addFavList({
      name: trimmed,
      type: FavListType.CUSTOM,
      bv_ids: [],
    });
    if (!created) {
      setCreateError('创建失败');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(created.id);
      return next;
    });
    setCreating(false);
    setNewName('');
    setCreateError(null);
    sendNotice({ type: NoticeType.SUCCESS, message: '已创建歌单', duration: 1500 });
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleQuickCreate();
    } else if (event.key === 'Escape') {
      // 阻断 Dialog 默认的 Esc 关闭，让 Esc 只用于退出输入态
      event.preventDefault();
      event.stopPropagation();
      cancelCreate();
    }
  };

  const handleConfirm = async () => {
    if (bvids.length === 0 || selected.size === 0) {
      close();
      return;
    }
    if (!isBatch) {
      // 单条：按 partMode 决定写入的 TrackId
      // - 'video' / 单 P 投稿：纯 bvid
      // - 'page'  + 多 P 投稿：buildTrackId(bvid, targetPage)
      const writeTrackId =
        showPartModeRadio && partMode === 'page' && singleBvid
          ? buildTrackId(singleBvid, targetPage)
          : (singleBvid ?? bvids[0]);
      selected.forEach((favId) => addFavVideo(favId, writeTrackId));
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

        {showPartModeRadio && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <Label className="text-xs text-muted-foreground">将什么加入歌单？</Label>
            <RadioGroup
              value={partMode}
              onValueChange={(v) => setPartMode(v as 'video' | 'page')}
              className="mt-2 flex flex-col gap-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <RadioGroupItem value="video" id="part-mode-video" className="shrink-0" />
                <Label
                  htmlFor="part-mode-video"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-sm font-normal"
                >
                  <span className="shrink-0">整个投稿</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    （播放时按默认 P / P1）
                  </span>
                </Label>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <RadioGroupItem value="page" id="part-mode-page" className="shrink-0" />
                <Label
                  htmlFor="part-mode-page"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-sm font-normal"
                >
                  <span className="shrink-0">仅 P{targetPage}</span>
                  {targetPagePart && (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      · {targetPagePart}
                    </span>
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {creating ? (
            <div>
              <div className="flex items-center gap-2 rounded-md border border-primary/40 px-3 py-2">
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  onKeyDown={handleNameKeyDown}
                  placeholder="输入歌单名称"
                  maxLength={40}
                  autoFocus
                  disabled={submitting}
                  className="h-8 flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={cancelCreate}
                  disabled={submitting}
                >
                  取消
                </Button>
                <Button type="button" size="sm" onClick={handleQuickCreate} disabled={submitting}>
                  创建
                </Button>
              </div>
              {createError && <p className="mt-1 px-3 text-xs text-destructive">{createError}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={submitting}
              className={cn(
                'flex items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-left text-sm text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-foreground',
                submitting && 'cursor-not-allowed opacity-50',
              )}
            >
              <Plus className="h-4 w-4" />
              <span>新建歌单</span>
            </button>
          )}

          {customLists.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              暂无可添加的自定义歌单，请先创建一个
            </p>
          ) : (
            <ScrollArea className="max-h-[40vh]">
              <div className="flex flex-col gap-1">
                {customLists.map((fav) => {
                  const isExcluded = !isBatch && fav.id === excludeId;
                  // 动态检测：目标歌单是否已包含待添加的 TrackId
                  // - 单条模式：歌单的 bv_ids 是否包含 writeTrackIdForSingle
                  // - 批量模式：歌单是否已完全包含所有待添加项（部分包含仍允许，store 内部去重）
                  const containsAll = isBatch
                    ? bvids.length > 0 && bvids.every((id) => fav.bv_ids.includes(id))
                    : writeTrackIdForSingle !== undefined &&
                      fav.bv_ids.includes(writeTrackIdForSingle);
                  const isDisabled = isExcluded || containsAll;
                  const isSelected = selected.has(fav.id);
                  const disabledLabel = isExcluded
                    ? '已包含'
                    : containsAll
                      ? isBatch
                        ? '已全部包含'
                        : '已包含'
                      : null;
                  return (
                    <button
                      key={fav.id}
                      type="button"
                      disabled={isDisabled || submitting}
                      onClick={() => toggle(fav.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                        isSelected ? 'border-primary bg-primary/10' : 'border-input',
                        (isDisabled || submitting) && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {iconForType(fav.type)}
                      <div className="flex-1 truncate">
                        <p className="truncate text-sm font-medium">{fav.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {fav.bv_ids.length} 首
                        </p>
                      </div>
                      {disabledLabel && (
                        <span className="text-xs text-muted-foreground">{disabledLabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

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
