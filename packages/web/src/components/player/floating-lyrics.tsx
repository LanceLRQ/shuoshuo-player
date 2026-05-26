import type { CSSProperties, ReactElement } from 'react';
import { usePlayerProfileStore, type FloatingLyricsColor } from '@shuoshuo-player/shared';
import { cn } from '@/lib/utils';

interface FloatingLyricsProps {
  /** 当前要显示的歌词文本（空字符串视为无歌词） */
  line: string;
  /** 父层算好的总开关：cfg.enabled && !showLyric && !!cur && !!line */
  visible: boolean;
}

/**
 * 预设文字色映射；'' 与 'primary' 同义，都跟随主题 --primary。
 * 用 hsl(var(--primary)) 形式保证 light/dark 主题切换时无需重渲染。
 */
const TEXT_COLOR_MAP: Record<FloatingLyricsColor, string> = {
  '': 'hsl(var(--primary))',
  primary: 'hsl(var(--primary))',
  white: '#ffffff',
  black: '#000000',
  muted: 'hsl(var(--muted-foreground))',
};

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const FAMILY_CLASS: Record<'sans' | 'serif' | 'mono', string> = {
  sans: '',
  serif: 'font-serif',
  mono: 'font-mono',
};

/**
 * 悬浮歌词：footer 上方一行当前歌词条。
 *
 * 设计要点：
 * - 配置统一从 usePlayerProfileStore.floatingLyrics 订阅，父层只传 visible + line
 *   避免 prop drilling，子组件不依赖 ui-shell。
 * - 容器 absolute 相对 footer（s-player 的 <footer> 是 relative 锚点），
 *   bottom 用 inline style 接 verticalOffset，允许用户 0-32 px 微调。
 * - 背景色用 hsl(var(--foreground)) 实现主题反色（亮主题深色底≈黑、暗主题浅色底≈白），
 *   CSS 变量切主题自动生效；inline style 接 cfg.bgOpacity 控制整条不透明度
 *   （JIT 不识别动态 bg 类，故用 inline）。
 */
export function FloatingLyrics({ line, visible }: FloatingLyricsProps): ReactElement | null {
  const cfg = usePlayerProfileStore((s) => s.floatingLyrics);

  if (!visible || !line) return null;

  // bottom: 100% 把元素底边贴在 footer 顶边；translateY(-Npx) 再上推 verticalOffset。
  // 分两段定位的原因：calc(100% + Npx) 在某些 grid + overflow 嵌套场景下被裁剪/失效，
  // transform 不参与布局流，无论父容器约束都能保证像素级偏移。
  const containerStyle: CSSProperties = {
    bottom: '100%',
    transform: `translateY(-${cfg.verticalOffset}px)`,
  };

  // 背景跟随 --foreground 主题变量反色（亮色深底 / 暗色浅底），整条共用 cfg.bgOpacity：
  // CSS opacity 同时作用于文字与背景，让用户用一个滑块控制"整条歌词条"的不透明度。
  const textStyle: CSSProperties = {
    fontSize: `${cfg.fontSize}px`,
    fontWeight: cfg.fontWeight === 'bold' ? 700 : 400,
    color: TEXT_COLOR_MAP[cfg.textColor],
    backgroundColor: 'hsl(var(--foreground))',
    opacity: cfg.bgOpacity,
    maxWidth: '60%',
  };

  return (
    <div
      className={cn('pointer-events-none absolute inset-x-0 flex px-3', ALIGN_CLASS[cfg.textAlign])}
      style={containerStyle}
      aria-hidden
      data-testid="floating-lyrics"
    >
      <p
        className={cn(
          'truncate rounded px-3 py-1 leading-tight transition-all',
          FAMILY_CLASS[cfg.fontFamily],
        )}
        style={textStyle}
      >
        {line}
      </p>
    </div>
  );
}
