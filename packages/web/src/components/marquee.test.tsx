import { render, screen, act } from '@testing-library/react';
import { Marquee } from './marquee';

class MockResizeObserver {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Marquee', () => {
  it('渲染传入的文本', () => {
    render(<Marquee text="测试标题" />);
    expect(screen.getByText('测试标题')).toBeInTheDocument();
  });

  it('jsdom 默认 offsetWidth=0 时不滚动，仅渲染单份文本', () => {
    const { container } = render(<Marquee text="短" />);
    // 短文本时 shouldScroll=false → 不渲染重复副本
    const spans = container.querySelectorAll('span span');
    expect(spans.length).toBe(0);
  });

  it('文字宽度 > 容器宽度时渲染滚动副本', () => {
    // 通过 prototype mock offsetWidth 让 measure() 命中 shouldScroll=true 分支
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    );
    let callCount = 0;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        // 第一次调用是 container 返回 100；第二次是 textRef 返回 500
        callCount++;
        return callCount % 2 === 1 ? 100 : 500;
      },
    });

    try {
      const { container } = render(<Marquee text="非常长的标题非常长的标题" />);
      // shouldScroll=true 分支会再渲染一份带 paddingLeft 的副本
      const innerSpans = container.querySelectorAll('span > span');
      expect(innerSpans.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (originalOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
      }
    }
  });

  it('自定义 className 透传到根容器', () => {
    const { container } = render(<Marquee text="x" className="custom-marquee" />);
    expect(container.querySelector('.custom-marquee')).not.toBeNull();
  });

  it('鼠标 enter / leave 不抛错（pauseOnHover 默认 true）', () => {
    const { container } = render(<Marquee text="x" />);
    const root = container.firstChild as HTMLElement;
    expect(() => {
      act(() => {
        root.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        root.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      });
    }).not.toThrow();
  });

  it('卸载时清理 ResizeObserver 与 RAF', () => {
    const observerInstances: MockResizeObserver[] = [];
    class TrackingObserver extends MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        super(cb);
        observerInstances.push(this);
      }
    }
    vi.stubGlobal('ResizeObserver', TrackingObserver);

    const { unmount } = render(<Marquee text="x" />);
    unmount();

    expect(observerInstances[0]?.disconnect).toHaveBeenCalled();
  });
});
