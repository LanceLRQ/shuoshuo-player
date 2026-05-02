import { useEffect, type ReactNode } from 'react';
import { usePlayerProfileStore } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';
import { useUIShell } from '@/stores/ui-shell';
import { TopBar } from './top-bar';
import { NavMenu } from './nav-menu';

interface PlayerLayoutProps {
  /** 主内容区（一般传入 <Outlet />） */
  children: ReactNode;
  /** 底部播放器（一般传入 <SPlayer />） */
  footer?: ReactNode;
  /** 浮层（弹窗 / 全屏歌词等） */
  overlays?: ReactNode;
}

/**
 * 三栏布局：TopBar (h-14) + NavMenu (w-64/16) + Main (Outlet) + Footer (h-20)
 *
 * 职责：
 * 1. 应用 light/dark/auto 主题（操作 document.documentElement.classList）
 * 2. 协调 sidebar 折叠状态
 * 3. 不在此处处理业务初始化（init.ts 负责持久化恢复）
 */
export function PlayerLayout({ children, footer, overlays }: PlayerLayoutProps) {
  const menuOpen = useUIShell((s) => s.menuOpen);
  const toggleMenu = useUIShell((s) => s.toggleMenu);

  const theme = usePlayerProfileStore((s) => s.theme);
  const getEffectiveTheme = usePlayerProfileStore((s) => s.getEffectiveTheme);

  useEffect(() => {
    const apply = () => {
      const effective = getEffectiveTheme();
      document.documentElement.classList.toggle('dark', effective === 'dark');
    };
    apply();

    if (theme !== 'auto') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [theme, getEffectiveTheme]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar menuOpen={menuOpen} onToggleMenu={toggleMenu} />
      <NavMenu menuOpen={menuOpen} />
      <main
        className={cn(
          'min-h-screen pt-14 pb-20 transition-[margin] duration-300',
          menuOpen ? 'ml-64' : 'ml-16',
        )}
      >
        <div className="px-6 py-4">{children}</div>
      </main>
      {footer}
      {overlays}
    </div>
  );
}
