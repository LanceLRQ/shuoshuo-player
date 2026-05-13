import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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

/** HSL → RGB（h: 0-360, s/l: 0-100），返回 [r,g,b] 0-255 整数 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** WCAG 相对亮度（0-1）：考虑人眼对绿色权重最高、蓝色最低 */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * 根据主色 HSL 选定 --primary-foreground：
 * - 偏亮主色（感知亮度 > 0.5）：返回同色相深字 `H S% 30%`，色调可辨
 * - 偏暗主色（感知亮度 ≤ 0.5）：返回纯白 `0 0% 100%`，对比最大化
 *
 * 阈值 0.5 对应「人眼明显偏向亮/暗」分界；预设色（粉/黄/浅绿/天蓝/深红/深蓝）实测全部符合直觉。
 */
function computePrimaryForeground(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  const lum = relativeLuminance(r, g, b);
  if (lum > 0.5) {
    return `${h} ${s}% 30%`;
  }
  return `0 0% 100%`;
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

  // 注入用户自定义主色到 CSS variable --primary（globals.css 的默认值会被覆盖）。
  // 同步根据主色「人眼感知亮度（WCAG 相对亮度）」生成 --primary-foreground：
  //   - 偏亮主色（luminance > 0.5，如默认粉/黄/浅绿/天蓝）→ 同色相深字（L=30），
  //     保留色调可辨且对比度高
  //   - 偏暗主色（luminance ≤ 0.5，如深红/深蓝/深紫）→ 纯白字，
  //     对比最大化，避免同色相亮字在深底上仍然不够清晰
  //
  // 不沿用旧版 HSL.L 阈值：黄色 HSL(60,100%,50%) 的 L=50 但实际感知很亮，
  // 旧逻辑会误判为「深色主色」给白字 → 黄底白字看不见。
  // WCAG luminance 公式考虑了人眼对红/绿/蓝的不同敏感度（绿权重最高、蓝最低）。
  //
  // dark 主题适配：用户自定义主色若过暗（luminance < 0.3），dark 模式下 text-primary
  // 在深底上看不清。检测后保持 H/S，把 L 提到 65（亮色版）注入；light 模式不动。
  // 这会同时影响 bg-primary（按钮背景），但 dark 主题下亮色按钮反而更显眼，符合 dark UI 直觉。
  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) {
      const m = primaryColor.trim().match(/^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%$/);
      if (m) {
        const h = parseFloat(m[1]);
        const s = parseFloat(m[2]);
        const l = parseFloat(m[3]);
        // dark 主题 + 主色偏暗 → 提亮到 L=65（保 H/S）；其他情况保持原值
        let actualPrimary = primaryColor;
        if (effectiveTheme === 'dark') {
          const [r, g, b] = hslToRgb(h, s, l);
          if (relativeLuminance(r, g, b) < 0.3) {
            actualPrimary = `${h} ${s}% 65%`;
          }
        }
        root.style.setProperty('--primary', actualPrimary);
        // --ring 同步主色：focus 高光跟随用户自定义色，避免一直停留在 globals.css 默认粉
        root.style.setProperty('--ring', actualPrimary);
        // foreground 按 actualPrimary 实际显示色重算（提亮后的色相也要新算前景色）
        const m2 = actualPrimary.trim().match(/^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%$/)!;
        const fg = computePrimaryForeground(
          parseFloat(m2[1]),
          parseFloat(m2[2]),
          parseFloat(m2[3]),
        );
        root.style.setProperty('--primary-foreground', fg);
      } else {
        root.style.setProperty('--primary', primaryColor);
        root.style.setProperty('--ring', primaryColor);
        root.style.removeProperty('--primary-foreground');
      }
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--primary-foreground');
    }
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
