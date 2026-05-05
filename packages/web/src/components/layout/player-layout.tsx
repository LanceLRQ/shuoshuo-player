import { useEffect, type ReactNode } from 'react';
import { usePlayerProfileStore } from '@shuoshuo-player/shared';
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
  const primaryColor = usePlayerProfileStore((s) => s.primaryColor);

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

  // 注入用户自定义主色到 CSS variable --primary（globals.css 的默认值会被覆盖）。
  // 设置为空字符串时 removeProperty 让 globals.css 默认值生效。
  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) {
      root.style.setProperty('--primary', primaryColor);
    } else {
      root.style.removeProperty('--primary');
    }
  }, [primaryColor]);

  return (
    <div className="grid h-screen grid-rows-[3.5rem_1fr_5rem] overflow-hidden bg-background text-foreground">
      {/* Row 1: TopBar (3.5rem = h-14) */}
      <TopBar menuOpen={menuOpen} onToggleMenu={toggleMenu} />

      {/* Row 2: 中间行，flex 左右布局 NavMenu + main；min-h-0 让 flex 子缩到容器内 */}
      <div className="flex min-h-0 overflow-hidden">
        <NavMenu menuOpen={menuOpen} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* 不在此处加 padding：让歌词面板等沉浸式视图能贴合 main 边缘；
              普通页面在 RootLayout 自行包 px-6 py-4 */}
          <div className="h-full">{children}</div>
        </main>
      </div>

      {/* Row 3: footer (5rem = h-20) */}
      {footer}

      {overlays}
    </div>
  );
}
