import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { getPlatformBridge, usePlayerProfileStore } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { TopBar } from './top-bar';
import { NavMenu } from './nav-menu';

/**
 * macOS Tauri 桌面端启用 titleBarStyle: Overlay 后，应用顶部需要让出 28px
 * 给系统 traffic light 按钮浮在 viewport 内。其他平台（Web / Chrome 扩展 /
 * Windows Tauri / Linux Tauri）不需要该安全区。
 *
 * 判定时机为模块加载期一次性，PlatformBridge.type 在 init.ts 注入后稳定。
 */
function detectMacTrafficLightArea(): boolean {
  try {
    if (getPlatformBridge().type !== 'tauri') return false;
  } catch {
    return false;
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /mac os x/i.test(ua);
}

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
  // 同步根据主色亮度生成 --primary-foreground：保留原 H/S，只反向 L，
  // 让 bg-primary 上的文字/图标使用"主色暗色版/亮色版"，避免纯黑白与底色割裂。
  // 设置为空字符串时 removeProperty 让 globals.css 默认值生效。
  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) {
      root.style.setProperty('--primary', primaryColor);
      const m = primaryColor.trim().match(/^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%$/);
      if (m) {
        const h = m[1];
        const s = m[2];
        const l = parseFloat(m[3]);
        // 阈值 60% 经验值：偏亮主色用深同色相（L=30，可辨色调而非视觉近黑）作前景；偏暗主色用极亮版（L=96）。
        const lFg = l >= 60 ? 30 : 96;
        root.style.setProperty('--primary-foreground', `${h} ${s}% ${lFg}%`);
      } else {
        root.style.removeProperty('--primary-foreground');
      }
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
    }
  }, [primaryColor]);

  const showMacTrafficLightArea = useMemo(() => detectMacTrafficLightArea(), []);
  const gridRows = showMacTrafficLightArea
    ? 'grid-rows-[1.75rem_3.5rem_1fr_5rem]'
    : 'grid-rows-[3.5rem_1fr_5rem]';
  const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties;

  return (
    <div
      className={`grid h-screen ${gridRows} overflow-hidden bg-muted text-foreground dark:bg-background`}
    >
      {/* macOS traffic light 安全区：仅 Tauri + macOS 时占用 row 0；
          整条 28px 高，shell 色（与 NavMenu / 根背景同色），整体支持拖动 */}
      {showMacTrafficLightArea && <div style={dragRegionStyle} aria-hidden />}

      {/* Row 1: TopBar (3.5rem = h-14) */}
      <TopBar menuOpen={menuOpen} onToggleMenu={toggleMenu} />

      {/* Row 2: 中间行，flex 左右布局 NavMenu + main；min-h-0 让 flex 子缩到容器内 */}
      <div className="flex min-h-0 overflow-hidden">
        <NavMenu menuOpen={menuOpen} />
        <main className="min-w-0 border-l flex-1 overflow-y-auto bg-background dark:bg-muted">
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
