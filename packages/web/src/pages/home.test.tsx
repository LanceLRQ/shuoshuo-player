import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  MASTER_UP_INFO,
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  usePlayingListStore,
} from '@shuoshuo-player/shared';
import { HomePage } from './home';

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
  usePlayingListStore.setState({ favId: '', bvIds: [], current: '', playNext: false });
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

  it('挂载时若 infos 为空 → readUserVideos(fully) + readUserSpaceInfo', () => {
    const readUserVideos = vi.fn(async () => {});
    const readUserSpaceInfo = vi.fn(async () => {});
    useBilibiliUserVideosStore.setState({ readUserVideos, readUserSpaceInfo });

    renderHome();

    expect(readUserVideos).toHaveBeenCalledWith(MASTER_MID, 'fully');
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

  it('latestVideos 渲染 VideoItem（最多 30 条）', () => {
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
    expect(screen.getAllByTestId('video-item')).toHaveLength(30);
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
    expect(state.bvIds).toHaveLength(10);
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

  it('点击"更新列表"按钮 → 打开 AlertDialog', async () => {
    useBilibiliUserVideosStore.setState({
      readUserVideos: vi.fn(),
      readUserSpaceInfo: vi.fn(),
    });
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /更新列表/ }));

    expect(await screen.findByText('更新视频列表')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '获取前 30 条' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '获取完整列表' })).toBeInTheDocument();
  });

  it('AlertDialog 中点击"获取前 30 条" → readUserVideos(default)', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /更新列表/ }));
    fireEvent.click(await screen.findByRole('button', { name: '获取前 30 条' }));

    await waitFor(() => {
      expect(readUserVideos).toHaveBeenCalledWith(MASTER_MID, 'default');
    });
  });
});
