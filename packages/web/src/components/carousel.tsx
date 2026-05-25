import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CarouselProps<T> {
  slides: T[];
  /** 渲染单张幻灯片；isSelected 标识是否为当前居中的焦点张 */
  renderSlide: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  /** 自动播放间隔（ms），默认 4000，与 v1 对齐 */
  autoplayDelay?: number;
  /** 是否启用循环（默认 true） */
  loop?: boolean;
  /** 对齐方式：'start' 左对齐（默认），'center' 居中并在两侧 peek 相邻张 */
  align?: 'start' | 'center';
  /** 每张 slide 外层 wrapper 的宽度/间距类；默认整宽 */
  slideClassName?: string;
  className?: string;
  onSlideClick?: (item: T, index: number) => void;
}

export function Carousel<T>({
  slides,
  renderSlide,
  autoplayDelay = 4000,
  loop = true,
  align = 'start',
  slideClassName = 'flex-[0_0_100%]',
  className,
  onSlideClick,
}: CarouselProps<T>) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop, align }, [
    Autoplay({ delay: autoplayDelay, stopOnInteraction: false }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    setSnapCount(emblaApi.scrollSnapList().length);
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi]);

  // 手动切换后必须 reset autoplay 计时器，否则刚切到下一张就可能立即被自动切走
  // （stopOnInteraction:false 下插件不会自动重置内部 setTimeout）
  const resetAutoplay = useCallback(() => {
    emblaApi?.plugins().autoplay?.reset();
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
    resetAutoplay();
  }, [emblaApi, resetAutoplay]);
  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
    resetAutoplay();
  }, [emblaApi, resetAutoplay]);
  const scrollTo = useCallback(
    (idx: number) => {
      emblaApi?.scrollTo(idx);
      resetAutoplay();
    },
    [emblaApi, resetAutoplay],
  );

  if (slides.length === 0) return null;

  return (
    <div className={cn('relative', className)}>
      <div ref={emblaRef} className="overflow-hidden rounded-lg">
        <div className="flex">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={cn('min-w-0 cursor-pointer', slideClassName)}
              onClick={() => onSlideClick?.(slide, index)}
            >
              {renderSlide(slide, index, index === selectedIndex)}
            </div>
          ))}
        </div>
      </div>
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          scrollPrev();
        }}
        aria-label="上一张"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          scrollNext();
        }}
        aria-label="下一张"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
        {Array.from({ length: snapCount }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scrollTo(idx);
            }}
            className={cn(
              'h-2 w-2 rounded-full transition-all',
              idx === selectedIndex ? 'w-6 bg-primary' : 'bg-white/60',
            )}
            aria-label={`跳到第 ${idx + 1} 张`}
          />
        ))}
      </div>
    </div>
  );
}
