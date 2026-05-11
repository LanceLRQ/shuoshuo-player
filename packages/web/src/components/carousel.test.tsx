import { fireEvent, render, screen, act } from '@testing-library/react';
import { Carousel } from './carousel';

// Mock embla：返回最小可用 API + 触发 onSelect 模拟
const emblaState = vi.hoisted(() => {
  const obj: {
    selected: number;
    api: ReturnType<typeof vi.fn> | null;
    callbacks: Record<string, ((...a: unknown[]) => void)[]>;
  } = {
    selected: 0,
    api: null,
    callbacks: {},
  };
  return obj;
});

// autoplay plugin mock：暴露 reset() 用于断言手动切换是否重置了计时器
const autoplayMock = vi.hoisted(() => ({ reset: vi.fn() }));

vi.mock('embla-carousel-react', () => ({
  default: () => {
    // 使用持久化 api 对象（每次 useEmblaCarousel 调用返回同一个）
    if (!emblaState.api) {
      const api = {
        selectedScrollSnap: () => emblaState.selected,
        scrollSnapList: () => [0, 1, 2, 3, 4],
        scrollPrev: vi.fn(() => {
          emblaState.selected = Math.max(0, emblaState.selected - 1);
          emblaState.callbacks.select?.forEach((c) => c());
        }),
        scrollNext: vi.fn(() => {
          emblaState.selected = Math.min(4, emblaState.selected + 1);
          emblaState.callbacks.select?.forEach((c) => c());
        }),
        scrollTo: vi.fn((idx: number) => {
          emblaState.selected = idx;
          emblaState.callbacks.select?.forEach((c) => c());
        }),
        on: (name: string, fn: () => void) => {
          emblaState.callbacks[name] = emblaState.callbacks[name] ?? [];
          emblaState.callbacks[name].push(fn);
        },
        off: vi.fn(),
        plugins: () => ({ autoplay: autoplayMock }),
      };
      emblaState.api = api as never;
    }
    return [vi.fn(), emblaState.api];
  },
}));

vi.mock('embla-carousel-autoplay', () => ({
  default: () => ({}),
}));

const SLIDES = [
  { id: 1, label: 'A' },
  { id: 2, label: 'B' },
  { id: 3, label: 'C' },
  { id: 4, label: 'D' },
  { id: 5, label: 'E' },
];

beforeEach(() => {
  emblaState.selected = 0;
  emblaState.callbacks = {};
  emblaState.api = null;
  autoplayMock.reset.mockClear();
});

describe('Carousel', () => {
  it('slides 为空时返回 null', () => {
    const { container } = render(<Carousel slides={[]} renderSlide={() => null} />);
    expect(container.firstChild).toBeNull();
  });

  it('渲染所有 slides', () => {
    render(
      <Carousel slides={SLIDES} renderSlide={(s) => <div data-testid="slide">{s.label}</div>} />,
    );
    expect(screen.getAllByTestId('slide')).toHaveLength(5);
  });

  it('点击上/下按钮调用 emblaApi.scrollPrev/scrollNext', () => {
    render(<Carousel slides={SLIDES} renderSlide={(s) => <div>{s.label}</div>} />);
    fireEvent.click(screen.getByRole('button', { name: '上一张' }));
    expect(emblaState.api!.scrollPrev).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    expect(emblaState.api!.scrollNext).toHaveBeenCalled();
  });

  it('点击 slide → onSlideClick(slide, index)', () => {
    const onSlideClick = vi.fn();
    const { container } = render(
      <Carousel
        slides={SLIDES}
        onSlideClick={onSlideClick}
        renderSlide={(s) => <div>{s.label}</div>}
      />,
    );
    // 第一个 slide 容器（class flex 内的子 div）
    const slideContainers = container.querySelectorAll('.flex > div.cursor-pointer');
    fireEvent.click(slideContainers[2]);
    expect(onSlideClick).toHaveBeenCalledWith(SLIDES[2], 2);
  });

  it('点击 dot 按钮触发 emblaApi.scrollTo(index)', () => {
    render(<Carousel slides={SLIDES} renderSlide={(s) => <div>{s.label}</div>} />);
    const dots = screen.getAllByRole('button', { name: /跳到第/ });
    expect(dots).toHaveLength(5);
    fireEvent.click(dots[3]);
    expect(emblaState.api!.scrollTo).toHaveBeenCalledWith(3);
  });

  it('手动切换 (prev/next/dot) 后会调用 autoplay.reset() 重置自动播放计时器', () => {
    render(<Carousel slides={SLIDES} renderSlide={(s) => <div>{s.label}</div>} />);

    fireEvent.click(screen.getByRole('button', { name: '上一张' }));
    expect(autoplayMock.reset).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    expect(autoplayMock.reset).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getAllByRole('button', { name: /跳到第/ })[2]);
    expect(autoplayMock.reset).toHaveBeenCalledTimes(3);
  });

  it('embla select 事件触发 selectedIndex 重新计算（高亮 dot）', () => {
    render(<Carousel slides={SLIDES} renderSlide={(s) => <div>{s.label}</div>} />);

    // 模拟 embla 触发 select 事件，selected = 2
    act(() => {
      emblaState.selected = 2;
      emblaState.callbacks.select?.forEach((c) => c());
    });

    const dots = screen.getAllByRole('button', { name: /跳到第/ });
    // 第 3 个 dot（idx=2）应有 w-6 class（active）
    expect(dots[2].className).toMatch(/w-6/);
  });
});
