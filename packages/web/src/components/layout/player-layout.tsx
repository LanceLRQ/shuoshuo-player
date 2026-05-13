import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { getPlatformBridge, usePlayerProfileStore } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { HSL_PATTERN, computeEffectivePrimary, computePrimaryForeground } from '@/lib/color';
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
  // 跟踪当前实际主题（auto 模式下随系统切换）：primaryColor effect 需要它做 dark 适配
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => getEffectiveTheme());

  useEffect(() => {
    const apply = () => {
      const effective = getEffectiveTheme();
      setEffectiveTheme(effective);
      document.documentElement.classList.toggle('dark', effective === 'dark');
    };
    apply();

    if (theme !== 'auto') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [theme, getEffectiveTheme]);

  // 注入用户自定义主色到 CSS variable --primary（globals.css 默认值被覆盖）。
  //
  // foreground 决策走 WCAG 相对亮度（不是 HSL.L）—— 因为 HSL.L 不能反映人眼感知，
  // 黄色 HSL(60,100%,50%) 的 L=50 但实际很亮；旧 HSL 阈值会判错给白字 → 黄底白字看不见。
  //
  // dark 主题下若主色过暗会自动提亮（computeEffectivePrimary），让 text-primary 在深底
  // 也清晰。算法/阈值/常量集中在 @/lib/color。
  //
  // 非法 HSL 字符串（如 #FF6687 / 'garbage'）→ 不写任何 CSS 变量并 console.warn 防伪状态。
  useEffect(() => {
    const root = document.documentElement;
    if (!primaryColor) {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--primary-foreground');
      return;
    }

    // 前置校验：非 HSL 格式直接放弃注入，让 globals.css 默认色生效，避免「半写」状态
    if (!HSL_PATTERN.test(primaryColor.trim())) {
      console.warn(
        '[player-layout] primaryColor 不是合法 HSL 字符串（"H S% L%"），已忽略：',
        primaryColor,
      );
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--primary-foreground');
      return;
    }

    const actualPrimary = computeEffectivePrimary(primaryColor, effectiveTheme);
    const m = actualPrimary.trim().match(HSL_PATTERN)!;
    const fg = computePrimaryForeground(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));

    root.style.setProperty('--primary', actualPrimary);
    // --ring 同步主色：focus 高光跟随用户自定义色，避免一直停留在 globals.css 默认值
    root.style.setProperty('--ring', actualPrimary);
    root.style.setProperty('--primary-foreground', fg);
  }, [primaryColor, effectiveTheme]);

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
