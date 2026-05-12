import { memo, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Music,
  MoreVertical,
  PlayCircle,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react';
import {
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  useFavListStore,
  usePlayingListStore,
  useUIStore,
  formatNumber10K,
  urlPrefixFixed,
  bilibiliThumbUrl,
  timeStampNow,
  FavListType,
  NoticeType,
  VIDEO_LIST_REFRESH_THRESHOLD,
  type FavListItem,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useUIShell } from '@/stores/ui-shell';

interface FavCardProps {
  favId: string;
  fav: FavListItem;
  className?: string;
}

/**
 * 把任意字符串映射到稳定的 [0, 360) 色相。
 * 用于自定义歌单兜底头像（首字 + hash 渐变）：相同 fav.id 永远得到相同的颜色，
 * UI 不会在 hydrate / 持久化往返之间漂移。
 */
function stringToHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360;
  }
  return h;
}

/**
 * 收藏歌单卡片：
 * - banner 头部 + stats grid（UPLOADER 有 spaceInfo 时显示）
 * - 24h 内未刷新则在 useEffect 自动触发 readUserVideos('default')
 * - 三种类型差异化菜单（CUSTOM 显示"添加歌曲"，UPLOADER/BILI_FAV 显示"更新前 30/更新全部"）
 */
function FavCardImpl({ favId, fav, className }: FavCardProps) {
  const navigate = useNavigate();
  const space = useBilibiliUserVideosStore((s) => (fav.mid ? s.space[String(fav.mid)] : undefined));
  const userVideoEntry = useBilibiliUserVideosStore((s) =>
    fav.mid ? s.infos[String(fav.mid)] : undefined,
  );
  const favFolder = useBilibiliUserVideosStore((s) =>
    fav.biliFavFolderId ? s.favFolders[String(fav.biliFavFolderId)] : undefined,
  );
  // 仅 dropdown 按钮 disabled UI 用；防重入由 store action 入口保证，无需在组件层做闭包检查
  const isLoading = useBilibiliUserVideosStore((s) => s.isLoading);
  const readUserVideos = useBilibiliUserVideosStore((s) => s.readUserVideos);
  const readUserSpaceInfo = useBilibiliUserVideosStore((s) => s.readUserSpaceInfo);
  const readUserFavFolderVideos = useBilibiliUserVideosStore((s) => s.readUserFavFolderVideos);

  const setPlaylist = usePlayingListStore((s) => s.setPlaylist);
  const removeFavList = useFavListStore((s) => s.removeFavList);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openFavEdit = useUIShell((s) => s.openFavEdit);
  const openAddSong = useUIShell((s) => s.openAddSong);
  const openConfirm = useUIShell((s) => s.openConfirm);

  const isCustom = fav.type === FavListType.CUSTOM;
  const isUploader = fav.type === FavListType.UPLOADER;
  const isBiliFav = fav.type === FavListType.BILI_FAV;
  // 系统级「我的收藏」：避免与用户自建 CUSTOM 歌单混淆，统一关闭"自定义"徽标 / 创建时间 / 自定义头像
  const isSystemFavorites = favId === 'favorites';
  // 紧凑模式：UPLOADER 保留 banner（头像 + 统计 + 简介），其他类型压缩为约两行高度
  const isCompact = !isUploader;
  const deletable = favId !== 'main';

  const folderInfo = (favFolder?.info ?? {}) as { cover?: string };

  /**
   * 按歌单类型解算真实可播放 bvId 列表（与 v1 PlayingListSlice.addFromFavList 行为对齐）：
   * - UPLOADER: useBilibiliUserVideosStore.infos[mid].video_list
   * - BILI_FAV: useBilibiliUserVideosStore.favFolders[folderId].video_list
   * - CUSTOM:   fav.bv_ids
   *
   * fav.bv_ids 字段语义上仅 CUSTOM 使用（见 types/playlist.ts），UPLOADER /
   * BILI_FAV 一直是空数组——这是导致"主歌单顶部播放按钮永远 disabled"的根因
   */
  const effectiveBvIds = useMemo<string[]>(() => {
    if (isUploader) {
      return userVideoEntry?.video_list.map((it) => it.bvid) ?? [];
    }
    if (isBiliFav) {
      return favFolder?.video_list.map((it) => it.bvid) ?? [];
    }
    return fav.bv_ids;
  }, [isUploader, isBiliFav, userVideoEntry, favFolder, fav.bv_ids]);

  // 防重入由 store action 入口保证（见 bilibili-user-videos.ts），useCallback 不再依赖 isLoading
  // 让引用稳定，下方 useEffect 才能放心把 updateList 列入 deps
  const updateList = useCallback(
    (mode: 'default' | 'fully' = 'default') => {
      if (isUploader && fav.mid) {
        readUserVideos(fav.mid, mode);
        readUserSpaceInfo(fav.mid);
      } else if (isBiliFav && fav.biliFavFolderId) {
        readUserFavFolderVideos(fav.biliFavFolderId, mode);
      }
    },
    [
      isUploader,
      isBiliFav,
      fav.mid,
      fav.biliFavFolderId,
      readUserVideos,
      readUserSpaceInfo,
      readUserFavFolderVideos,
    ],
  );

  // 24h 自动更新检测：仅 UPLOADER / BILI_FAV，且 store 已有 video 数据时（避免新建即拉取）
  // lastUpdate 取 store 实时值而非 props.fav.update_time —— 后者对 MAIN_FAV_ITEM 写死 0 会永久过期
  const hasVideos = effectiveBvIds.length > 0;
  const lastUpdate = isUploader
    ? (userVideoEntry?.update_time ?? 0)
    : (favFolder?.update_time ?? 0);
  useEffect(() => {
    if (!isUploader && !isBiliFav) return;
    if (!hasVideos) return;
    if (lastUpdate + VIDEO_LIST_REFRESH_THRESHOLD >= timeStampNow()) return;
    updateList('default');
  }, [isUploader, isBiliFav, hasVideos, lastUpdate, updateList]);

  const handlePlay = useCallback(() => {
    if (effectiveBvIds.length === 0) {
      sendNotice({ type: NoticeType.WARN, message: '歌单为空', duration: 2000 });
      return;
    }
    setPlaylist(favId, effectiveBvIds, effectiveBvIds[0], true);
  }, [effectiveBvIds, favId, setPlaylist, sendNotice]);

  const handleDelete = useCallback(() => {
    openConfirm({
      title: '删除歌单',
      description: isCustom
        ? '请注意这是一个自定义歌单，删除后数据将无法被恢复！'
        : '确定要删除这个歌单吗？',
      destructive: true,
      confirmText: '删除',
      onConfirm: () => {
        removeFavList(favId);
        sendNotice({ type: NoticeType.SUCCESS, message: '删除成功', duration: 2000 });
        navigate('/index');
      },
    });
  }, [openConfirm, isCustom, removeFavList, favId, sendNotice, navigate]);

  // 首张视频封面（用于 CUSTOM / BILI_FAV 的兜底头像；UPLOADER 走 space.face，无需）
  const firstVideoCover = useBilibiliVideosStore((s) => {
    if (isUploader) return null;
    const firstBv = effectiveBvIds[0];
    if (!firstBv) return null;
    return s.entities[firstBv]?.pic ?? null;
  });

  const avatar = useMemo(() => {
    // 紧凑模式（非 UPLOADER）：头像缩到 h-12，避免占用一整行 banner 高度
    const sizeCls = isCompact ? 'h-12 w-12' : 'h-20 w-20';
    if (isSystemFavorites) {
      // 与左侧栏「我的收藏」NavRow 视觉对齐：黄色 Star
      return (
        <div
          className={cn(
            'flex items-center justify-center rounded-full border-2 border-background bg-yellow-50 shadow dark:bg-yellow-500/10',
            sizeCls,
          )}
          aria-label="我的收藏"
        >
          <Star
            className={cn('fill-yellow-500 text-yellow-500', isCompact ? 'h-6 w-6' : 'h-10 w-10')}
          />
        </div>
      );
    }
    if (space?.face) {
      return (
        <Avatar className={cn('border-2 border-background shadow', sizeCls)}>
          <AvatarImage src={urlPrefixFixed(space.face)} alt={space.name} />
          <AvatarFallback>{space.name?.[0]}</AvatarFallback>
        </Avatar>
      );
    }
    if (folderInfo.cover) {
      return (
        <Avatar className={cn('border-2 border-background shadow', sizeCls)}>
          <AvatarImage src={urlPrefixFixed(folderInfo.cover)} alt={fav.name} />
          <AvatarFallback>{fav.name?.[0]}</AvatarFallback>
        </Avatar>
      );
    }
    // CUSTOM / BILI_FAV：优先取首张视频封面（v1 导入或刷新前 BILI_FAV 也无 folderInfo.cover）
    // 都为空时退化为"首字 + hash 渐变"，确保不同歌单视觉可区分
    if (isCustom || isBiliFav) {
      // [...str][0] 安全处理 emoji / 中文字符（避免 surrogate pair 截半）
      const initial = fav.name ? [...fav.name][0] : '?';
      if (firstVideoCover) {
        return (
          <Avatar className={cn('rounded-md border-2 border-background shadow', sizeCls)}>
            <AvatarImage src={bilibiliThumbUrl(firstVideoCover, 200, 200)} alt={fav.name} />
            <AvatarFallback className="rounded-md">{initial}</AvatarFallback>
          </Avatar>
        );
      }
      const hue = stringToHue(fav.id || fav.name || 'fav');
      return (
        <div
          className={cn(
            'flex items-center justify-center rounded-full border-2 border-background font-semibold text-white shadow',
            sizeCls,
            isCompact ? 'text-base' : 'text-3xl',
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 60%), hsl(${(hue + 60) % 360} 70% 48%))`,
          }}
          aria-label={fav.name}
        >
          {initial}
        </div>
      );
    }
    return (
      <Avatar className={cn('border-2 border-background shadow', sizeCls)}>
        <AvatarFallback>
          <Music className={cn('text-muted-foreground', isCompact ? 'h-6 w-6' : 'h-10 w-10')} />
        </AvatarFallback>
      </Avatar>
    );
  }, [
    space,
    folderInfo,
    fav.name,
    fav.id,
    isCustom,
    isBiliFav,
    isSystemFavorites,
    isCompact,
    firstVideoCover,
  ]);

  const bgStyle = space?.top_photo
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.55)),url(${urlPrefixFixed(space.top_photo)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card text-card-foreground',
        className,
      )}
      style={bgStyle}
    >
      <div className={cn(isCompact ? 'p-3' : 'p-6')}>
        <div className={cn('flex gap-4', isSystemFavorites ? 'items-center' : 'items-start')}>
          {avatar}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={cn('truncate text-xl font-semibold', space?.top_photo && 'text-white')}
              >
                {space?.name ?? fav.name}
              </h3>
              {!isSystemFavorites && <Badge variant="secondary">{getTypeLabel(fav.type)}</Badge>}
            </div>
            {!isSystemFavorites && (
              <p
                className={cn(
                  'mt-1 truncate text-sm text-muted-foreground',
                  space?.top_photo && 'text-white/80',
                )}
              >
                {space?.sign ??
                  `创建于 ${dayjs(fav.create_time * 1000).format('YYYY 年 MM 月 DD 日 HH:mm')}`}
              </p>
            )}
            {space?.stats && (
              <div
                className={cn(
                  'mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground',
                  space.top_photo && 'text-white/90',
                )}
              >
                <Stat label="关注" value={space.stats.following} />
                <Stat label="粉丝" value={space.stats.follower} />
                <Stat label="点赞" value={space.stats.likes} />
                <Stat label="播放" value={space.stats.view} />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" onClick={handlePlay} disabled={effectiveBvIds.length === 0}>
              <PlayCircle className="mr-2 h-4 w-4" />
              播放
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {isCustom && (
                  <DropdownMenuItem onSelect={() => openAddSong(favId)}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加歌曲
                  </DropdownMenuItem>
                )}
                {(isUploader || isBiliFav) && (
                  <>
                    <DropdownMenuItem onSelect={() => updateList('default')} disabled={isLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      更新前 30
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => updateList('fully')} disabled={isLoading}>
                      <Star className="mr-2 h-4 w-4" />
                      更新整个列表
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => openFavEdit(favId)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  编辑歌单
                </DropdownMenuItem>
                {deletable && (
                  <DropdownMenuItem
                    onSelect={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除歌单
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 列表中卡片高频出现，memo 包装避免无关 store 字段变更触发重渲染 */
export const FavCard = memo(FavCardImpl);

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-start">
      <span className="font-medium">{label}</span>
      <span>{formatNumber10K(value)}</span>
    </div>
  );
}

function getTypeLabel(type: FavListType): string {
  switch (type) {
    case FavListType.UPLOADER:
      return 'UP 主';
    case FavListType.BILI_FAV:
      return 'B 站收藏夹';
    default:
      return '自定义';
  }
}
