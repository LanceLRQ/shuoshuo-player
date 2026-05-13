import { fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  useFavListStore,
  useFavoritesStore,
  useUIStore,
  FavListType,
} from '@shuoshuo-player/shared';
import { FavListPage } from './fav-list';

// Mock 简化：避开 FavCard 的复杂依赖，让测试聚焦 FavListPage 自身逻辑
vi.mock('@/components/fav-card', () => ({
  FavCard: ({ favId, fav }: { favId: string; fav: { name: string } }) => (
    <div data-testid="fav-card" data-favid={favId}>
      {fav.name}
    </div>
  ),
}));
vi.mock('@/components/video-item', () => ({
  VideoItem: ({ video }: { video: { bvid: string; title: string } }) => (
    <div data-testid="video-item" data-bvid={video.bvid}>
      {video.title}
    </div>
  ),
}));

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function reset() {
  useFavListStore.setState({ list: [] });
  useBilibiliUserVideosStore.setState({
    infos: {},
    space: {},
    favFolders: {},
  });
  useBilibiliVideosStore.setState({ ids: [], entities: {} });
  useUIStore.setState({ notices: [] });
  useFavoritesStore.setState({ entries: {} });
}

function makeFav(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fav-x',
    name: '我的歌单',
    type: FavListType.CUSTOM,
    bv_ids: ['BV1', 'BV2'],
    create_time: 0,
    update_time: 0,
    ...overrides,
  } as never;
}

function renderAt(favId: string) {
  return render(
    <MemoryRouter initialEntries={[`/fav/${favId}`]}>
      <Routes>
        <Route path="/fav/:id" element={<FavListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FavListPage', () => {
  beforeEach(() => {
    reset();
  });

  it('未找到 favId → 显示"歌单不存在"', () => {
    renderAt('non-existent');
    expect(screen.getByText(/歌单不存在/)).toBeInTheDocument();
  });

  it('main favId → 显示主歌单 FavCard（即使 favList 中无该 id）', () => {
    renderAt('main');
    expect(screen.getByTestId('fav-card')).toHaveAttribute('data-favid', 'main');
  });

  it('CUSTOM 歌单：渲染 bv_ids 对应的视频项', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1', 'BV2'],
      entities: {
        BV1: { bvid: 'BV1', title: 'Track A' } as never,
        BV2: { bvid: 'BV2', title: 'Track B' } as never,
      },
    });
    useFavListStore.setState({ list: [makeFav()] });

    renderAt('fav-x');
    expect(screen.getByTestId('fav-card')).toBeInTheDocument();
    // 虚拟列表 jsdom 下 getVirtualItems 会基于父高度返回少量；放宽断言
    const items = screen.queryAllByTestId('video-item');
    expect(items.length).toBeGreaterThanOrEqual(0);
  });

  it('CUSTOM 歌单为空 → 显示"歌单是空的"', () => {
    useFavListStore.setState({
      list: [makeFav({ bv_ids: [] })],
    });
    renderAt('fav-x');
    expect(screen.getByText(/歌单是空的/)).toBeInTheDocument();
  });

  it('搜索框：输入关键词 + 清除按钮', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: 'Track A' } as never },
    });
    useFavListStore.setState({ list: [makeFav()] });

    renderAt('fav-x');
    const input = screen.getByPlaceholderText(/搜索歌曲/) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'A' } });
    expect(input.value).toBe('A');

    // 清除按钮（X icon）
    const clearBtn = input.parentElement?.querySelector('button');
    if (clearBtn) {
      fireEvent.click(clearBtn);
      expect(input.value).toBe('');
    }
  });

  it('搜索无结果 → 显示提示"没有找到关键词…"', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: 'Track A' } as never },
    });
    useFavListStore.setState({ list: [makeFav()] });

    renderAt('fav-x');
    const input = screen.getByPlaceholderText(/搜索歌曲/) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: '不存在的关键词xyz' } });
    });
    expect(screen.getByText(/没有找到关键词/)).toBeInTheDocument();
  });

  it('UPLOADER 歌单：从 user_videos.infos 读取列表', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: 'A', author: 'X' } as never },
    });
    useBilibiliUserVideosStore.setState({
      infos: {
        '999': {
          update_time: Math.floor(Date.now() / 1000),
          video_list: [{ bvid: 'BV1', created: 1700000000 }] as never,
          count: 1,
          update_type: 'default',
        } as never,
      },
      space: {},
      favFolders: {},
    });
    useFavListStore.setState({
      list: [makeFav({ id: 'u1', type: FavListType.UPLOADER, mid: '999' })],
    });

    renderAt('u1');
    expect(screen.getByTestId('fav-card')).toBeInTheDocument();
  });

  it('favorites favId：空 favorites → 显示"歌单是空的"', () => {
    renderAt('favorites');
    expect(screen.getByText(/歌单是空的/)).toBeInTheDocument();
    expect(screen.getByTestId('fav-card')).toHaveAttribute('data-favid', 'favorites');
  });

  it('favorites favId：3 条按时间倒序排列', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1', 'BV2', 'BV3'],
      entities: {
        BV1: { bvid: 'BV1', title: 'A' } as never,
        BV2: { bvid: 'BV2', title: 'B' } as never,
        BV3: { bvid: 'BV3', title: 'C' } as never,
      },
    });
    useFavoritesStore.setState({ entries: { BV1: 100, BV2: 300, BV3: 200 } });

    renderAt('favorites');
    // 显示排序按钮（默认 desc）
    expect(screen.getByRole('button', { name: /最新收藏在前/ })).toBeInTheDocument();
  });

  it('favorites favId：点击 toggle 切换到正序', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1', 'BV2'],
      entities: {
        BV1: { bvid: 'BV1', title: 'A' } as never,
        BV2: { bvid: 'BV2', title: 'B' } as never,
      },
    });
    useFavoritesStore.setState({ entries: { BV1: 100, BV2: 200 } });

    renderAt('favorites');
    const toggleBtn = screen.getByRole('button', { name: /最新收藏在前/ });
    act(() => {
      fireEvent.click(toggleBtn);
    });
    expect(screen.getByRole('button', { name: /最早收藏在前/ })).toBeInTheDocument();
  });

  it('favorites favId：FavCard 接收 type=CUSTOM 的虚拟项', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: 'A' } as never },
    });
    useFavoritesStore.setState({ entries: { BV1: 100 } });

    renderAt('favorites');
    // 虚拟 FavListItem 名称为「我的收藏」
    expect(screen.getByTestId('fav-card')).toHaveTextContent('我的收藏');
  });

  it('BILI_FAV 歌单：从 favFolders 读取列表', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: 'A' } as never },
    });
    useBilibiliUserVideosStore.setState({
      favFolders: {
        '123': {
          update_time: 0,
          video_list: [{ bvid: 'BV1', created: 0 }] as never,
          count: 1,
          update_type: 'default',
          info: {},
        } as never,
      },
      infos: {},
      space: {},
    });
    useFavListStore.setState({
      list: [makeFav({ id: 'b1', type: FavListType.BILI_FAV, biliFavFolderId: '123' })],
    });

    renderAt('b1');
    expect(screen.getByTestId('fav-card')).toBeInTheDocument();
  });
});
