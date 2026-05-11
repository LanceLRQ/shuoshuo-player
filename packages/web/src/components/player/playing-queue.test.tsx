import { fireEvent, render, screen } from '@testing-library/react';
import { useBilibiliVideosStore, usePlayingListStore } from '@shuoshuo-player/shared';
import { PlayingQueue } from './playing-queue';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function reset() {
  usePlayingListStore.setState({
    favId: '',
    bvIds: [],
    current: '',
    playNext: false,
  });
  useBilibiliVideosStore.setState({ ids: [], entities: {} });
  // matchMedia mock
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('PlayingQueue', () => {
  beforeEach(() => {
    reset();
  });

  it('open=false 时不渲染内容', () => {
    render(<PlayingQueue open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('播放队列')).not.toBeInTheDocument();
  });

  it('open=true + 队列为空时显示空状态', () => {
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    // SheetTitle (sr-only) + h3 (visible) 各渲染一次"播放队列"
    expect(screen.getAllByText('播放队列').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('共 0 首')).toBeInTheDocument();
    expect(screen.getByText('队列为空')).toBeInTheDocument();
  });

  it('open=true 时显示可见标题 h3', () => {
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 3, name: '播放队列' })).toBeInTheDocument();
  });

  it('队列有曲目时按 bvIds 顺序渲染', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1', 'BV2'],
      entities: {
        BV1: { bvid: 'BV1', title: 'Track A', pic: '' } as never,
        BV2: { bvid: 'BV2', title: 'Track B', pic: '' } as never,
      },
    });
    usePlayingListStore.setState({ bvIds: ['BV1', 'BV2'], current: 'BV1' });

    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    expect(screen.getByText('共 2 首')).toBeInTheDocument();
    expect(screen.getByText('Track A')).toBeInTheDocument();
    expect(screen.getByText('Track B')).toBeInTheDocument();
  });

  it('点击队列项 → updateCurrentPlaying + playNext=true', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1', 'BV2'],
      entities: {
        BV1: { bvid: 'BV1', title: 'Track A', pic: '' } as never,
        BV2: { bvid: 'BV2', title: 'Track B', pic: '' } as never,
      },
    });
    usePlayingListStore.setState({ bvIds: ['BV1', 'BV2'], current: 'BV1' });

    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Track B').closest('div[data-bv]')!);

    expect(usePlayingListStore.getState().current).toBe('BV2');
    expect(usePlayingListStore.getState().playNext).toBe(true);
  });

  it('点击清空按钮 → clearPlaylist', () => {
    usePlayingListStore.setState({ bvIds: ['BV1'], current: 'BV1' });
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: 'A', pic: '' } as never },
    });

    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /清空/ }));

    const state = usePlayingListStore.getState();
    expect(state.bvIds).toEqual([]);
    expect(state.current).toBe('');
  });

  it('队列为空时清空按钮 disabled', () => {
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /清空/ })).toBeDisabled();
  });

  it('窄屏 (max-width 1024px) 时 Sheet 走 bottom side', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    // 窄屏 SheetContent 应有 h-[60vh] class（vs 宽屏的 w-[400px]）
    expect(document.body.querySelector('[class*="h-\\[60vh\\]"]')).toBeTruthy();
  });
});
