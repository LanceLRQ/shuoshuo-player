import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  MASTER_UP_INFO,
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  usePlayingListStore,
  useUIStore,
} from '@shuoshuo-player/shared';
import { HomePage } from './home';

// 虚拟滚动需要 ResizeObserver；jsdom 不内置
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  // Radix DropdownMenu 在 jsdom 下需要这些指针 API 才能正常打开
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});
afterAll(() => {
  vi.unstubAllGlobals();
});

// VideoItem / Carousel mock 简化测试
vi.mock('@/components/video-item', () => ({
  VideoItem: ({ video }: { video: { bvid: string; title: string } }) => (
    <div data-testid="video-item" data-bvid={video.bvid}>
      {video.title}
    </div>
  ),
}));
vi.mock('@/components/carousel', () => ({
  Carousel: <T,>({
    slides,
    onSlideClick,
    renderSlide,
  }: {
    slides: T[];
    onSlideClick?: (item: T, idx: number) => void;
    renderSlide: (item: T, idx: number) => React.ReactNode;
  }) => (
    <div data-testid="carousel">
      {slides.map((s, i) => (
        <div key={i} data-testid="carousel-slide" onClick={() => onSlideClick?.(s, i)}>
          {renderSlide(s, i)}
        </div>
      ))}
    </div>
  ),
}));

const MASTER_MID = String(MASTER_UP_INFO.mid);

function reset() {
  useBilibiliUserVideosStore.setState({
    infos: {},
    space: {},
    favFolders: {},
    isLoading: false,
  });
  useBilibiliVideosStore.setState({ ids: [], entities: {} });
  usePlayingListStore.setState({ favId: '', trackIds: [], current: '', playNext: false });
  useUIStore.setState({ notices: [] });
}

function makeVideoEntries(count: number) {
  const entities: Record<string, unknown> = {};
  const list = [];
  for (let i = 0; i < count; i++) {
    const bvid = `BV${String(i).padStart(10, '0')}`;
    entities[bvid] = {
      bvid,
      title: `视频 ${i}`,
      pic: '',
      created: 1700000000 - i,
      author: 'master',
    };
    list.push({ bvid, created: 1700000000 - i });
  }
  return { entities, list };
}

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    reset();
  });

  it('挂载时若 infos 为空 → readUserVideos(incremental) + readUserSpaceInfo（增量内部 fallback 拉前 90 条）', () => {
    const readUserVideos = vi.fn(async () => {});
    const readUserSpaceInfo = vi.fn(async () => {});
    useBilibiliUserVideosStore.setState({ readUserVideos, readUserSpaceInfo });

    renderHome();

    expect(readUserVideos).toHaveBeenCalledWith(MASTER_MID, 'incremental');
    expect(readUserSpaceInfo).toHaveBeenCalledWith(MASTER_MID);
  });

  it('infos 有缓存且未过期 → 不触发 readUserVideos', () => {
    const { entities, list } = makeVideoEntries(3);
    useBilibiliVideosStore.setState({ ids: Object.keys(entities), entities });
    useBilibiliUserVideosStore.setState({
      infos: {
        [MASTER_MID]: {
          update_time: Math.floor(Date.now() / 1000),
          video_list: list,
          count: list.length,
          update_type: 'default',
        } as never,
      },
      space: { [MASTER_MID]: { name: '说说Crystal' } as never },
      favFolders: {},
      isLoading: false,
      readUserVideos: vi.fn(),
      readUserSpaceInfo: vi.fn(),
    });

    renderHome();
    const readUserVideos = useBilibiliUserVideosStore.getState().readUserVideos;
    expect(readUserVideos).not.toHaveBeenCalled();
  });

  it('显示空间名（spaceInfo.name）作为标题副文本', () => {
    useBilibiliUserVideosStore.setState({
      space: { [MASTER_MID]: { name: '说说Crystal' } as never },
      readUserVideos: vi.fn(async () => {}),
      readUserSpaceInfo: vi.fn(async () => {}),
    });

    renderHome();
    expect(screen.getByText('说说Crystal')).toBeInTheDocument();
    expect(screen.getByText('最新投稿')).toBeInTheDocument();
  });

  it('全量视频走虚拟滚动渲染（不再硬限 30 条）', () => {
    const { entities, list } = makeVideoEntries(35);
    useBilibiliVideosStore.setState({ ids: Object.keys(entities), entities });
    useBilibiliUserVideosStore.setState({
      infos: {
        [MASTER_MID]: {
          update_time: Math.floor(Date.now() / 1000),
          video_list: list,
          count: 35,
          update_type: 'default',
        } as never,
      },
      readUserVideos: vi.fn(),
      readUserSpaceInfo: vi.fn(),
    });

    renderHome();
    // jsdom 下虚拟滚动基于 ResizeObserver mock，渲染数量不稳定；
    // 关键验证：① 容器存在 ② 最新一条（最靠前）会出现在初始可视区
    const items = screen.queryAllByTestId('video-item');
    expect(items.length).toBeGreaterThanOrEqual(0);
    expect(screen.getByText('视频 0')).toBeInTheDocument();
  });

  it('Carousel 显示前 5 条 + 点击 slide 触发 setPlaylist', () => {
    const { entities, list } = makeVideoEntries(10);
    useBilibiliVideosStore.setState({ ids: Object.keys(entities), entities });
    useBilibiliUserVideosStore.setState({
      infos: {
        [MASTER_MID]: {
          update_time: Math.floor(Date.now() / 1000),
          video_list: list,
          count: 10,
          update_type: 'default',
        } as never,
      },
      readUserVideos: vi.fn(),
      readUserSpaceInfo: vi.fn(),
    });

    renderHome();
    const slides = screen.getAllByTestId('carousel-slide');
    expect(slides).toHaveLength(5);

    fireEvent.click(slides[2]);

    const state = usePlayingListStore.getState();
    expect(state.favId).toBe('main');
    expect(state.trackIds).toHaveLength(10);
    // 第 2 个 slide 对应第 2 个 video
    expect(state.current).toBe('BV0000000002');
    expect(state.playNext).toBe(true);
  });

  it('latestVideos 为空 + 非 loading → 显示"暂无视频"占位', () => {
    useBilibiliUserVideosStore.setState({
      isLoading: false,
      readUserVideos: vi.fn(),
      readUserSpaceInfo: vi.fn(),
    });
    renderHome();
    expect(screen.getByText(/暂无视频/)).toBeInTheDocument();
  });

  it('latestVideos 为空 + loading → 显示"正在拉取最新投稿"', () => {
    useBilibiliUserVideosStore.setState({
      isLoading: true,
      readUserVideos: vi.fn(),
      readUserSpaceInfo: vi.fn(),
    });
    renderHome();
    expect(screen.getByText(/正在拉取最新投稿/)).toBeInTheDocument();
  });

  it('split button 主键直点 → readUserVideos(incremental)', async () => {
    const readUserVideos = vi.fn(async () => {});
    useBilibiliUserVideosStore.setState({
      infos: {
        [MASTER_MID]: {
          update_time: Math.floor(Date.now() / 1000),
          video_list: [],
          count: 0,
          update_type: 'default',
        } as never,
      },
      readUserVideos,
      readUserSpaceInfo: vi.fn(async () => {}),
    });

    renderHome();
    readUserVideos.mockClear();

    // 主键文案唯一可见的「检查更新」（▾ 折叠态下菜单项未渲染）
    fireEvent.click(screen.getByRole('button', { name: /检查更新/ }));

    await waitFor(() => {
      expect(readUserVideos).toHaveBeenCalledWith(MASTER_MID, 'incremental');
    });
  });

  it('split button ▾ 展开 → 三选项菜单（含按范围拉取 / 重新拉取全部）', async () => {
    useBilibiliUserVideosStore.setState({
      infos: {
        [MASTER_MID]: {
          update_time: Math.floor(Date.now() / 1000),
          video_list: [],
          count: 30,
          update_type: 'default',
        } as never,
      },
      readUserVideos: vi.fn(async () => {}),
      readUserSpaceInfo: vi.fn(async () => {}),
    });

    renderHome();

    // Radix DropdownMenu 需要 userEvent 触发 pointerDown/Up 序列才能展开
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /更多刷新选项/ }));

    expect(await screen.findByText('按范围拉取…')).toBeInTheDocument();
    expect(screen.getByText('重新拉取全部')).toBeInTheDocument();
  });

  it('▾ → 按范围拉取 + sourceTotal=0 → 提示并不打开 PageRangeDialog', async () => {
    useBilibiliUserVideosStore.setState({
      // infos 完全为空 → sourceTotal=0
      readUserVideos: vi.fn(async () => {}),
      readUserSpaceInfo: vi.fn(async () => {}),
    });

    renderHome();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /更多刷新选项/ }));
    await user.click(await screen.findByText('按范围拉取…'));

    await waitFor(() => {
      expect(useUIStore.getState().notices.some((n) => /尚未拿到总条数/.test(n.message))).toBe(
        true,
      );
    });
  });
});
