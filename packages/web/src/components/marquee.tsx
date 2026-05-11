import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps {
  text: string;
  /**
   * 等效像素/帧（按 60fps 折算为 px/秒，内部以时间为基计算位移），默认 0.5。
   * 例如 speed=0.5 在任意刷新率下都等于 30 px/秒，避免 120Hz/144Hz 屏幕上滚动过快。
   */
  speed?: number;
  /** 副本间距 px，默认 32 */
  gap?: number;
  /** 鼠标悬停暂停（默认 true） */
  pauseOnHover?: boolean;
  className?: string;
}

/**
 * RAF 滚动文字。文字宽度 ≤ 容器宽度时不滚动，避免短标题抖动（与 v1 行为对齐）。
 */
export function Marquee({
  text,
  speed = 0.5,
  gap = 32,
  pauseOnHover = true,
  className,
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;
    const measure = () => {
      const containerW = containerRef.current?.offsetWidth ?? 0;
      const textW = textRef.current?.offsetWidth ?? 0;
      setShouldScroll(textW > containerW);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [text]);

  useEffect(() => {
    if (!shouldScroll || !textRef.current) {
      offsetRef.current = 0;
      if (textRef.current) textRef.current.style.transform = 'translateX(0)';
      return;
    }
    // speed 入参语义为「等效 60fps 下 px/帧」，内部统一以 px/秒 + dt 推进，
    // 跨刷新率（60/120/144Hz）表现一致；标签切回 / 长暂停产生的大 dt 截断到 100ms
    // 避免一次跳变（与肉眼无差的最大平滑步进）。
    const pxPerSec = speed * 60;
    let lastTime = 0;

    const tick = (now: number) => {
      if (lastTime === 0) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!pausedRef.current && textRef.current) {
        offsetRef.current += pxPerSec * dt;
        // 外层 span 渲染结构为 [text][gap padding][text]，故
        //   offsetWidth = 2 * textWidth + gap
        // 一个完整循环周期（第二份移动到第一份的起始位置）= textWidth + gap
        //                                               = (offsetWidth + gap) / 2
        // 旧实现用 offsetWidth / 2 + gap 触发归零，多走了 gap/2，导致归零瞬间回跳抖动。
        const period = (textRef.current.offsetWidth + gap) / 2;
        if (offsetRef.current >= period) {
          // 减一个周期而非归零，保留亚像素余量，让回环点视觉上无缝衔接
          offsetRef.current -= period;
        }
        textRef.current.style.transform = `translateX(-${offsetRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldScroll, speed, gap]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden whitespace-nowrap', className)}
      onMouseEnter={() => {
        if (pauseOnHover) pausedRef.current = true;
      }}
      onMouseLeave={() => {
        if (pauseOnHover) pausedRef.current = false;
      }}
    >
      <span ref={textRef} className="inline-block will-change-transform">
        {text}
        {shouldScroll && (
          <span className="inline-block" style={{ paddingLeft: gap }}>
            {text}
          </span>
        )}
      </span>
    </div>
  );
}
