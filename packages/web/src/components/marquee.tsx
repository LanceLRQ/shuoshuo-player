import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps {
  text: string;
  /** 像素/帧，默认 1 */
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
  speed = 1,
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
    const tick = () => {
      if (!pausedRef.current && textRef.current) {
        offsetRef.current += speed;
        const textW = textRef.current.offsetWidth / 2;
        if (offsetRef.current >= textW + gap) {
          offsetRef.current = 0;
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
