import { type CSSProperties, type MouseEvent, memo, useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Play,
  PlayCircle,
  Clock,
  MessageSquare,
  Plus,
  MoreVertical,
  ExternalLink,
  Trash2,
  User,
  Star,
  Layers,
  Pin,
  PinOff,
} from 'lucide-react';
import {
  usePlayingListStore,
  useUIStore,
  useFavoritesStore,
  useVideoPagePrefStore,
  formatNumber10K,
  buildTrackId,
  bilibiliThumbUrl,
  getPlatformBridge,
  NoticeType,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PartBadge } from './part-badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useUIShell } from '@/stores/ui-shell';

export interface VideoItemProps {
  video: BilibiliVideo;
  /**
   * 该条目的显式 P（来自 TrackId 的 :p<n> 部分）；
   * undefined / 缺省视为纯 bvid 条目，按 video-page-pref 偏好播放。
   */
  explicitPage?: number;
  /** 所在歌单 ID，决定播放时是否加载整张歌单 */
  favId?: string;
  showAuthor?: boolean;
  fullCreateTime?: boolean;
  /** 搜索结果 <em> 高亮通过 dangerouslySetInnerHTML 渲染 */
  htmlTitle?: boolean;
  /** 来自搜索结果时主按钮变为"添加到歌单" */
  fromSearch?: boolean;
  /** 显示"添加到歌单"按钮（默认 true） */
  showAddBtn?: boolean;
  /** 显示"加入队列尾部"按钮（默认 true） */
  showAddToPlayBtn?: boolean;
  showRemoveBtn?: boolean;
  onRemove?: (bvid: string) => void;
  onAddToFav?: (video: BilibiliVideo, fromSearch?: boolean) => void;
  /** 批量勾选模式：左侧显示复选框，整行点击切换选中，隐藏右侧操作按钮 */
  selectMode?: boolean;
  /** 当前条目是否被选中（仅 selectMode 下生效） */
  selected?: boolean;
  /** 选中态切换回调（仅 selectMode 下生效） */
  onToggleSelect?: (bvid: string) => void;
  style?: CSSProperties;
  className?: string;
}

function VideoItemImpl({
  video,
  explicitPage,
  favId,
  showAuthor = false,
  fullCreateTime = false,
  htmlTitle = false,
  fromSearch = false,
  showAddBtn = true,
  showAddToPlayBtn = true,
  showRemoveBtn = false,
  onRemove,
  onAddToFav,
  selectMode = false,
  selected = false,
  onToggleSelect,
  style,
  className,
}: VideoItemProps) {
  const currentBvId = usePlayingListStore((s) => s.current);
  const setPlaylist = usePlayingListStore((s) => s.setPlaylist);
  const addSingle = usePlayingListStore((s) => s.addSingle);
  const sendNotice = useUIStore((s) => s.sendNotice);
  // selector 只订阅当前 bvid 的存在性，避免其他收藏变化导致整列重渲染
  const isFavored = useFavoritesStore((s) => video.bvid in s.entries);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  // 默认 P 偏好 + 操作（D3）：仅多 P 投稿菜单中显示"记住默认 P"入口
  const defaultPage = useVideoPagePrefStore((s) => s.defaultPage[video.bvid] ?? 1);
  const setDefaultPage = useVideoPagePrefStore((s) => s.setDefaultPage);
  const openAddToFav = useUIShell((s) => s.openAddToFav);
  const [imgError, setImgError] = useState(false);

  const totalP = video.videos ?? 1;
  const isMultiPart = totalP > 1;
  /**
   * 归一化分 P 列表：有 view 元数据时取 pages，缺失时用 1..totalP 占位（仅显示 P 序号）。
   * 让 DropdownMenuSub 子项渲染统一一份 map，避免双分支重复。
   */
  const partItems = useMemo<Array<{ key: string | number; page: number; part?: string }>>(() => {
    if (video.pages && video.pages.length > 0) {
      return video.pages.map((p) => ({ key: p.cid, page: p.page, part: p.part }));
    }
    return Array.from({ length: totalP }, (_, i) => ({ key: i + 1, page: i + 1 }));
  }, [video.pages, totalP]);

  const handleAddPageToFav = useCallback(
    (page: number) => {
      openAddToFav(buildTrackId(video.bvid, page), { fromSearch });
    },
    [openAddToFav, video.bvid, fromSearch],
  );

  const handlePinDefaultPage = useCallback(
    (page: number) => {
      setDefaultPage(video.bvid, page);
      sendNotice({
        type: NoticeType.SUCCESS,
        message: page <= 1 ? '已清除默认 P 设置' : `已设默认 P${page}`,
        duration: 2000,
      });
    },
    [setDefaultPage, sendNotice, video.bvid],
  );

  const isPlaying = currentBvId === video.bvid;

  const handlePlayClick = useCallback(() => {
    if (favId) {
      // 由调用方决定是否要预先 setPlaylist；这里仅插入并标记 playNow
      addSingle(video.bvid, true);
    } else {
      setPlaylist('', [video.bvid], video.bvid, true);
    }
  }, [addSingle, setPlaylist, favId, video.bvid]);

  const handleAddToPlay = useCallback(() => {
    addSingle(video.bvid, false);
    sendNotice({ type: NoticeType.SUCCESS, message: '添加成功', duration: 2000 });
  }, [addSingle, sendNotice, video.bvid]);

  const handleAddToFav = useCallback(() => {
    onAddToFav?.(video, fromSearch);
  }, [onAddToFav, video, fromSearch]);

  const handleToggleLike = useCallback(() => {
    const nextFavored = toggleFavorite(video.bvid);
    sendNotice({
      type: NoticeType.SUCCESS,
      message: nextFavored ? '已添加到我的收藏' : '已从我的收藏移除',
      duration: 2000,
    });
  }, [toggleFavorite, sendNotice, video.bvid]);

  // 封面/行可直接触发播放：仅在非批量选择、非搜索结果场景启用
  const canPlayDirect = !selectMode && !fromSearch;

  const handleCoverClick = useCallback(
    (e: MouseEvent) => {
      if (!canPlayDirect) return;
      e.stopPropagation();
      handlePlayClick();
    },
    [canPlayDirect, handlePlayClick],
  );

  const handleRowDoubleClick = useCallback(() => {
    if (!canPlayDirect) return;
    handlePlayClick();
  }, [canPlayDirect, handlePlayClick]);

  const handleOpenBilibili = useCallback(() => {
    void getPlatformBridge().shell.openExternal(`https://www.bilibili.com/video/${video.bvid}`);
  }, [video.bvid]);

  const createdLabel = video.created
    ? fullCreateTime
      ? dayjs(video.created * 1000).format('YYYY 年 MM 月 DD 日 HH:mm')
      : dayjs(video.created * 1000).fromNow()
    : '';

  const handleRowClick = useCallback(() => {
    if (selectMode) onToggleSelect?.(video.bvid);
  }, [selectMode, onToggleSelect, video.bvid]);

  return (
    <div
      style={style}
      onClick={selectMode ? handleRowClick : undefined}
      onDoubleClick={canPlayDirect ? handleRowDoubleClick : undefined}
      className={cn(
        'group/row flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
        !selectMode && 'hover:bg-accent/50',
        !selectMode && isPlaying && 'bg-accent',
        canPlayDirect && 'select-none',
        selectMode && 'cursor-pointer hover:bg-accent/50',
        selectMode && selected && 'border border-primary/40 bg-primary/10',
        selectMode && !selected && 'border border-transparent',
        className,
      )}
    >
      {selectMode && (
        <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect?.(video.bvid)}
            aria-label={selected ? '取消选择' : '选择'}
          />
        </div>
      )}
      <div
        onClick={canPlayDirect ? handleCoverClick : undefined}
        role={canPlayDirect ? 'button' : undefined}
        aria-label={canPlayDirect ? '播放' : undefined}
        className={cn(
          'relative h-12 w-20 shrink-0 overflow-hidden rounded bg-muted',
          canPlayDirect && 'cursor-pointer',
        )}
      >
        {!imgError && video.pic ? (
          <img
            src={bilibiliThumbUrl(video.pic, 200, 125)}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PlayCircle className="h-6 w-6" />
          </div>
        )}
        {isPlaying ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 dark:bg-black/60">
            <PlayCircle className="h-5 w-5 text-white" />
          </div>
        ) : (
          canPlayDirect && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 dark:bg-black/60">
              <PlayCircle className="h-5 w-5 text-white" />
            </div>
          )
        )}
        {/* 多 P 投稿右下角标：单 P 不渲染（PartBadge 内部判定） */}
        <div className="pointer-events-none absolute bottom-0.5 right-0.5">
          <PartBadge video={video} explicitPage={explicitPage} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {isMultiPart && (
            <Badge
              variant="outline"
              className="shrink-0 rounded border-primary/40 bg-primary/15 px-1 py-0 text-[10px] font-medium leading-tight tabular-nums text-primary"
              aria-label={`共 ${totalP} 分 P`}
            >
              {totalP}P
            </Badge>
          )}
          {htmlTitle ? (
            <p
              className="min-w-0 flex-1 truncate text-sm font-medium [&>em]:not-italic [&>em]:text-primary"
              dangerouslySetInnerHTML={{ __html: video.title }}
            />
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{video.title}</p>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showAuthor && video.author && (
            <Badge variant="outline" className="gap-1 font-normal">
              <User className="h-3 w-3" />
              {video.author}
            </Badge>
          )}
          {createdLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {createdLabel}
            </span>
          )}
          {typeof video.play === 'number' && (
            <span className="inline-flex items-center gap-1">
              <Play className="h-3 w-3" />
              {formatNumber10K(video.play)}
            </span>
          )}
          {typeof video.comment === 'number' && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {formatNumber10K(video.comment)}
            </span>
          )}
        </div>
      </div>

      {!selectMode && (
        <div className="flex shrink-0 items-center gap-1">
          <TooltipProvider delayDuration={300}>
            {fromSearch ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleAddToFav}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>添加到歌单</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleToggleLike} aria-label="收藏">
                    <Star className={cn('h-4 w-4', isFavored && 'fill-current text-yellow-500')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFavored ? '取消收藏' : '收藏'}</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="更多操作">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showAddToPlayBtn && (
                  <DropdownMenuItem onSelect={handleAddToPlay}>
                    <Clock className="mr-2 h-4 w-4" />
                    稍后播放
                  </DropdownMenuItem>
                )}
                {showAddBtn && (
                  <DropdownMenuItem onSelect={handleAddToFav}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加到歌单
                  </DropdownMenuItem>
                )}
                {showAddBtn && isMultiPart && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Layers className="mr-2 h-4 w-4" />
                      选择分 P 添加到歌单
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[60vh] w-64 overflow-y-auto">
                      {partItems.map((it) => (
                        <DropdownMenuItem
                          key={`add-${it.key}`}
                          onSelect={() => handleAddPageToFav(it.page)}
                          className="min-w-0"
                        >
                          <span className="mr-2 shrink-0 tabular-nums text-muted-foreground">
                            P{it.page}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {it.part || `分P ${it.page}`}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {isMultiPart && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Pin className="mr-2 h-4 w-4" />
                      记住默认 P{defaultPage >= 2 ? `（当前 P${defaultPage}）` : ''}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[60vh] w-64 overflow-y-auto">
                      {partItems.map((it) => (
                        <DropdownMenuItem
                          key={`pin-${it.key}`}
                          onSelect={() => handlePinDefaultPage(it.page)}
                          className="min-w-0"
                        >
                          <span
                            className={cn(
                              'mr-2 shrink-0 tabular-nums',
                              defaultPage === it.page
                                ? 'font-semibold text-primary'
                                : 'text-muted-foreground',
                            )}
                          >
                            P{it.page}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {it.part || `分P ${it.page}`}
                          </span>
                        </DropdownMenuItem>
                      ))}
                      {defaultPage >= 2 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handlePinDefaultPage(1)}>
                            <PinOff className="mr-2 h-4 w-4" />
                            清除默认 P 设置
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {(showAddBtn || showAddToPlayBtn) && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={handleOpenBilibili}>
                  <ExternalLink className="mr-2 h-4 w-4" />去 B 站看
                </DropdownMenuItem>
                {showRemoveBtn && onRemove && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onRemove(video.bvid)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      移除歌曲
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

/**
 * 列表项组件，外层使用虚拟列表/普通列表都会高频重渲染。memo 包装可避免父组件刷新
 * 时无变化的行重复 render；上层回调用 useCallback 包裹是 memo 生效的前提。
 */
export const VideoItem = memo(VideoItemImpl);
