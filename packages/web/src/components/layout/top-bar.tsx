import { useCallback } from 'react';
import { Menu, Sun, Moon, Cloud, LogOut, Download, Upload } from 'lucide-react';
import {
  useBilibiliUserStore,
  usePlayerProfileStore,
  useCloudServiceStore,
  useUIStore,
  EXPORT_KEYS,
  NoticeType,
  PERSIST_DATA_KEY,
  getPlatformBridge,
} from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useUIShell } from '@/stores/ui-shell';

interface TopBarProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

const GITHUB_URL = 'https://github.com/LanceLRQ/shuoshuo-player';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.467-2.38 1.235-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.3 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.29-1.553 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.234 1.91 1.234 3.22 0 4.61-2.807 5.622-5.48 5.92.43.372.823 1.102.823 2.222 0 1.604-.014 2.896-.014 3.293 0 .322.218.694.825.576C20.565 22.092 24 17.598 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function TopBar({ menuOpen, onToggleMenu }: TopBarProps) {
  const user = useBilibiliUserStore((s) => s.current);
  const theme = usePlayerProfileStore((s) => s.theme);
  const setTheme = usePlayerProfileStore((s) => s.setTheme);
  const getEffectiveTheme = usePlayerProfileStore((s) => s.getEffectiveTheme);
  const cloudIsLogin = useCloudServiceStore((s) => s.isLogin());
  const cloudRoleName = useCloudServiceStore((s) => s.roleName());
  const clearCloudSession = useCloudServiceStore((s) => s.clearSession);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openCloudLogin = useUIShell((s) => s.openCloudLogin);

  const effectiveTheme = getEffectiveTheme();
  const ThemeIcon = effectiveTheme === 'dark' ? Sun : Moon;

  const handleToggleTheme = useCallback(() => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  }, [effectiveTheme, setTheme]);

  const handleExport = useCallback(async () => {
    try {
      const raw = await getPlatformBridge().storage.getItem(PERSIST_DATA_KEY);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const filtered: Record<string, unknown> = {};
      for (const key of EXPORT_KEYS) {
        if (key in all) filtered[key] = all[key];
      }
      const text = JSON.stringify(filtered, null, 2);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `导出数据_${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      sendNotice({ type: NoticeType.SUCCESS, message: '导出成功', duration: 2000 });
    } catch (e) {
      console.debug(e);
      sendNotice({ type: NoticeType.ERROR, message: '导出失败', duration: 3000 });
    }
  }, [sendNotice]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (loadEvent) => {
        if (!window.confirm('确定要导入数据吗？导入后当前数据将被覆盖')) return;
        try {
          const data = JSON.parse(loadEvent.target?.result as string);
          const { storage } = getPlatformBridge();
          const raw = await storage.getItem(PERSIST_DATA_KEY);
          const merged = { ...(raw ? JSON.parse(raw) : {}), ...data };
          await storage.setItem(PERSIST_DATA_KEY, JSON.stringify(merged));
          sendNotice({ type: NoticeType.SUCCESS, message: '导入成功，即将刷新', duration: 1500 });
          setTimeout(() => window.location.reload(), 1500);
        } catch {
          sendNotice({
            type: NoticeType.ERROR,
            message: '导入失败，文件格式不正确',
            duration: 3000,
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [sendNotice]);

  return (
    <header className="z-50 flex h-14 items-center border-b bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMenu}
        aria-label={menuOpen ? '收起菜单' : '展开菜单'}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <span className="ml-2 font-semibold tracking-tight">说说播放器</span>

      <div className="ml-auto flex items-center gap-1">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void getPlatformBridge().shell.openExternal(GITHUB_URL)}
                aria-label="GitHub"
              >
                <GithubIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>喜欢的话点个 star</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleToggleTheme} aria-label="切换主题">
                <ThemeIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {effectiveTheme === 'dark' ? '切换到亮色' : '切换到暗色'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="账户菜单">
              <Avatar className="h-8 w-8">
                {user?.face ? <AvatarImage src={user.face} alt={user.uname} /> : null}
                <AvatarFallback className="text-xs">{user?.uname?.[0] ?? '?'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuLabel className="flex items-center gap-2">
              <span className="truncate">{user?.uname ?? '未登录'}</span>
              {theme === 'auto' && (
                <Badge variant="secondary" className="ml-auto">
                  自动主题
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={openCloudLogin}>
              <Cloud className="mr-2 h-4 w-4" />
              <span className="flex-1">云服务</span>
              {cloudIsLogin && (
                <Badge variant="default" className="ml-2">
                  {cloudRoleName}
                </Badge>
              )}
            </DropdownMenuItem>
            {cloudIsLogin && (
              <DropdownMenuItem onSelect={() => clearCloudSession()}>
                <LogOut className="mr-2 h-4 w-4" />
                退出云服务
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              导入数据
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              导出数据
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              主题模式
            </DropdownMenuLabel>
            <ThemeRadio current={theme} onChange={setTheme} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ThemeRadio({
  current,
  onChange,
}: {
  current: 'light' | 'dark' | 'auto';
  onChange: (t: 'light' | 'dark' | 'auto') => void;
}) {
  const items: Array<{ value: 'light' | 'dark' | 'auto'; label: string }> = [
    { value: 'light', label: '亮色' },
    { value: 'dark', label: '暗色' },
    { value: 'auto', label: '跟随系统' },
  ];
  return (
    <>
      {items.map((item) => (
        <DropdownMenuItem
          key={item.value}
          onSelect={() => onChange(item.value)}
          className={current === item.value ? 'bg-accent' : ''}
        >
          <span className="ml-6">{item.label}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
