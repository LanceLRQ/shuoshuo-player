import { fireEvent, render, screen } from '@testing-library/react';
import { useBilibiliVideosStore, usePlayingListStore } from '@shuoshuo-player/shared';
import { PlayingQueue } from './playing-queue';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function reset() {
  usePlayingListStore.setState({
    favId: '',
    trackIds: [],
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
    expect(screen.queryByText('播放列表')).not.toBeInTheDocument();
  });

  it('open=true + 队列为空时显示空状态', () => {
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    // SheetTitle (sr-only) + h3 (visible) 各渲染一次"播放列表"
    expect(screen.getAllByText('播放列表').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('共 0 首')).toBeInTheDocument();
    expect(screen.getByText('队列为空')).toBeInTheDocument();
  });

  it('open=true 时显示可见标题 h3', () => {
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 3, name: '播放列表' })).toBeInTheDocument();
  });

  it('队列有曲目时按 trackIds 顺序渲染', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1', 'BV2'],
      entities: {
        BV1: { bvid: 'BV1', title: 'Track A', pic: '' } as never,
        BV2: { bvid: 'BV2', title: 'Track B', pic: '' } as never,
      },
    });
    usePlayingListStore.setState({ trackIds: ['BV1', 'BV2'], current: 'BV1' });

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
    usePlayingListStore.setState({ trackIds: ['BV1', 'BV2'], current: 'BV1' });

    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Track B').closest('div[data-bv]')!);

    expect(usePlayingListStore.getState().current).toBe('BV2');
    expect(usePlayingListStore.getState().playNext).toBe(true);
  });

  it('点击清空按钮 → clearPlaylist', () => {
    usePlayingListStore.setState({ trackIds: ['BV1'], current: 'BV1' });
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: 'A', pic: '' } as never },
    });

    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /清空/ }));

    const state = usePlayingListStore.getState();
    expect(state.trackIds).toEqual([]);
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

describe('PlayingQueue: 多 P 投稿折叠展开（C3）', () => {
  beforeEach(() => {
    reset();
    usePlayerRuntimeStore.setState({ playingPage: 1, switchToPage: undefined });
  });

  const MULTI_BV = 'BV1Multi00001';
  const setupMulti = () => {
    useBilibiliVideosStore.setState({
      ids: [MULTI_BV],
      entities: {
        [MULTI_BV]: {
          aid: 1,
          bvid: MULTI_BV,
          created: 0,
          length: '',
          pic: '',
          is_union_video: false,
          title: 'Multi Track',
          sub_title: '',
          play: 0,
          comment: 0,
          author: 'Up',
          description: '',
          videos: 3,
          pages: [
            { cid: 100, page: 1, part: 'Intro', duration: 60 },
            { cid: 101, page: 2, part: 'Verse', duration: 90 },
            { cid: 102, page: 3, part: 'Outro', duration: 30 },
          ],
        },
      },
    });
  };

  it('多 P 投稿（纯 bvid）渲染展开按钮 + 标题后显示 NP', () => {
    setupMulti();
    usePlayingListStore.setState({ trackIds: [MULTI_BV], current: MULTI_BV });
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '展开分 P' })).toBeInTheDocument();
    expect(screen.getByText(/3P/)).toBeInTheDocument();
  });

  it('单 P 投稿不渲染展开按钮', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Single'],
      entities: {
        BV1Single: {
          aid: 1,
          bvid: 'BV1Single',
          created: 0,
          length: '',
          pic: '',
          is_union_video: false,
          title: 'Single',
          sub_title: '',
          play: 0,
          comment: 0,
          author: 'Up',
          description: '',
        },
      },
    });
    usePlayingListStore.setState({ trackIds: ['BV1Single'], current: 'BV1Single' });
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /展开分 P/ })).toBeNull();
  });

  it('显式 :p<n> 条目不渲染展开按钮，但显示 P 标识', () => {
    setupMulti();
    const explicitTrack = `${MULTI_BV}:p2`;
    usePlayingListStore.setState({ trackIds: [explicitTrack], current: explicitTrack });
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /展开分 P/ })).toBeNull();
    // 标题旁有 P2 显式标识
    expect(screen.getByText('P2')).toBeInTheDocument();
  });

  it('点展开按钮 → 列出所有 P + 当前播放 P 高亮', () => {
    setupMulti();
    usePlayingListStore.setState({ trackIds: [MULTI_BV], current: MULTI_BV });
    usePlayerRuntimeStore.setState({ playingPage: 2 });
    render(<PlayingQueue open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '展开分 P' }));

    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Verse')).toBeInTheDocument();
    expect(screen.getByText('Outro')).toBeInTheDocument();

    // playingPage=2 的 P 高亮（aria-selected）
    const p2Btn = screen.getByRole('option', { name: /播放 P2/ });
    expect(p2Btn.getAttribute('aria-selected')).toBe('true');
  });

  it('点 P 调 switchToPage 而不动 store.current', () => {
    setupMulti();
    const switchToPage = vi.fn();
    usePlayingListStore.setState({ trackIds: [MULTI_BV], current: MULTI_BV });
    usePlayerRuntimeStore.setState({ switchToPage });
    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '展开分 P' }));

    fireEvent.click(screen.getByRole('option', { name: /播放 P3/ }));

    expect(switchToPage).toHaveBeenCalledWith(3);
    // store.current 不变
    expect(usePlayingListStore.getState().current).toBe(MULTI_BV);
  });

  it('非当前播放条目展开后点 P：先把该条目设为 current，再 switchToPage', () => {
    useBilibiliVideosStore.setState({
      ids: [MULTI_BV, 'BV1Other'],
      entities: {
        [MULTI_BV]: {
          aid: 1,
          bvid: MULTI_BV,
          created: 0,
          length: '',
          pic: '',
          is_union_video: false,
          title: 'Multi',
          sub_title: '',
          play: 0,
          comment: 0,
          author: 'Up',
          description: '',
          videos: 2,
          pages: [
            { cid: 100, page: 1, part: 'A', duration: 60 },
            { cid: 101, page: 2, part: 'B', duration: 90 },
          ],
        },
        BV1Other: {
          aid: 2,
          bvid: 'BV1Other',
          created: 0,
          length: '',
          pic: '',
          is_union_video: false,
          title: 'Other',
          sub_title: '',
          play: 0,
          comment: 0,
          author: '',
          description: '',
        },
      },
    });
    const switchToPage = vi.fn();
    usePlayingListStore.setState({
      trackIds: ['BV1Other', MULTI_BV],
      current: 'BV1Other',
    });
    usePlayerRuntimeStore.setState({ switchToPage });

    render(<PlayingQueue open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '展开分 P' }));
    fireEvent.click(screen.getByRole('option', { name: /播放 P2/ }));

    expect(usePlayingListStore.getState().current).toBe(MULTI_BV);
    expect(switchToPage).toHaveBeenCalledWith(2);
  });
});
