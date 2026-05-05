import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Search,
  Tv,
  Cloud,
  Heart,
  ListMusic,
  Star,
  Video,
  Plus,
  Settings,
} from 'lucide-react';
import {
  useFavListStore,
  useBilibiliUserVideosStore,
  useCloudServiceStore,
  FavListType,
  MASTER_UP_INFO,
  type FavListItem,
} from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useUIShell } from '@/stores/ui-shell';

interface NavMenuProps {
  menuOpen: boolean;
}

interface FixedItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

export function NavMenu({ menuOpen }: NavMenuProps) {
  const favList = useFavListStore((s) => s.list);
  const spaceInfos = useBilibiliUserVideosStore((s) => s.space);
  const isCloudAdmin = useCloudServiceStore((s) => s.isAdmin());
  const openFavEdit = useUIShell((s) => s.openFavEdit);

  const fixedItems = useMemo<FixedItem[]>(() => {
    const base: FixedItem[] = [
      { to: '/index', label: '首页', icon: <Home className="h-4 w-4" /> },
      { to: '/discovery', label: '搜索发现', icon: <Search className="h-4 w-4" /> },
      { to: '/live-slicers', label: '直播切片', icon: <Tv className="h-4 w-4" /> },
    ];
    if (isCloudAdmin) {
      base.push({
        to: '/cloud-services/lyrics',
        label: '云服务',
        icon: <Cloud className="h-4 w-4" />,
      });
    }
    base.push({
      to: '/settings',
      label: '设置',
      icon: <Settings className="h-4 w-4" />,
    });
    return base;
  }, [isCloudAdmin]);

  const renderFavIcon = (fav: FavListItem) => {
    if (fav.type === FavListType.UPLOADER && fav.mid) {
      const space = spaceInfos[String(fav.mid)];
      if (space?.face) {
        return (
          <Avatar className="h-5 w-5">
            <AvatarImage src={space.face} alt={space.name} />
            <AvatarFallback className="text-[10px]">{space.name?.[0] ?? '?'}</AvatarFallback>
          </Avatar>
        );
      }
      return <Video className="h-4 w-4" />;
    }
    if (fav.type === FavListType.BILI_FAV) return <Star className="h-4 w-4" />;
    return <ListMusic className="h-4 w-4" />;
  };

  return (
    <aside
      className={cn(
        'h-full shrink-0 border-r bg-background transition-[width] duration-300',
        menuOpen ? 'w-64' : 'w-16',
      )}
      aria-label="侧边导航"
    >
      <ScrollArea className="h-full">
        <TooltipProvider delayDuration={200}>
          {/* w-full：Radix ScrollArea Viewport 内部的 display:table 包装会让 nav 默认按
              content-width 排版，nav 不撑满后子项的 w-full 也只取 fit-content；显式 w-full 强制
              nav 撑满 Viewport 宽度（64px / 256px），子项的 justify-center 才能真正几何居中 */}
          <nav className="flex w-full flex-col gap-0.5 p-2">
            {fixedItems.map((item) => (
              <NavRow key={item.to} item={item} collapsed={!menuOpen} />
            ))}

            <Separator className="my-2" />

            {menuOpen && (
              <p className="px-2 pb-1 text-xs uppercase tracking-wide text-muted-foreground">
                我的歌单
              </p>
            )}

            <NavRow
              item={{
                to: '/fav/main',
                label: MASTER_UP_INFO.uname,
                icon: <Heart className="h-4 w-4 text-rose-500" />,
              }}
              collapsed={!menuOpen}
            />

            {favList.map((fav) => (
              <NavRow
                key={fav.id}
                item={{
                  to: `/fav/${fav.id}`,
                  label: fav.name,
                  icon: renderFavIcon(fav),
                }}
                collapsed={!menuOpen}
              />
            ))}

            <Separator className="my-2" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'h-9 w-full',
                    menuOpen ? 'justify-start px-3' : 'justify-center px-0',
                  )}
                  onClick={() => openFavEdit(null)}
                >
                  <Plus className="h-4 w-4" />
                  {menuOpen && <span className="ml-2">创建歌单</span>}
                </Button>
              </TooltipTrigger>
              {!menuOpen && <TooltipContent side="right">创建歌单</TooltipContent>}
            </Tooltip>
          </nav>
        </TooltipProvider>
      </ScrollArea>
    </aside>
  );
}

function NavRow({ item, collapsed }: { item: FixedItem; collapsed: boolean }) {
  // 不用 NavLink className 函数形式：实测 className=fn 在生产构建（minified + React 19 / RR v7）
  // 下被 toString 后整体写入 DOM class 属性，浏览器按空格分割时只识别字符串内"碰巧没和前后字符
  // 黏连"的 token，导致 justify-center / px-0 等条件类失效。改用 string + aria-current 选择器：
  // NavLink active 时自动给 a 加 aria-current="page"，Tailwind 的 aria-[current=page]: 变体直接生效。
  const link = (
    <NavLink
      to={item.to}
      className={cn(
        'flex h-9 w-full items-center rounded-md px-3 text-sm font-medium transition-colors',
        'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        'aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:hover:bg-accent',
        collapsed && 'justify-center px-0',
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span>
      {!collapsed && <span className="ml-2 truncate">{item.label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
