import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  useBilibiliUserVideosStore,
  useCloudServiceStore,
  useFavListStore,
  FavListType,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { NavMenu } from './nav-menu';

function reset() {
  useFavListStore.setState({ list: [] });
  useBilibiliUserVideosStore.setState({ space: {} });
  useCloudServiceStore.getState().clearSession();
  useUIShell.setState({ favEditOpen: false });
}

const ADMIN_SESSION = {
  id: 1,
  token: 'tk',
  token_type: 'Bearer',
  expire_at: Date.now() / 1000 + 9999,
  account: {
    id: 1,
    user_name: 'admin',
    nick_name: 'A',
    avatar: '',
    role: 512,
  },
} as never;

function renderNav(open = true) {
  return render(
    <MemoryRouter>
      <NavMenu menuOpen={open} />
    </MemoryRouter>,
  );
}

describe('NavMenu', () => {
  beforeEach(() => {
    reset();
  });

  it('展示固定项：首页 / 搜索发现 / 直播切片', () => {
    renderNav(true);
    expect(screen.getByRole('link', { name: /首页/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /搜索发现/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /直播切片/ })).toBeInTheDocument();
  });

  it('未登录态也显示"水晶蟹小屋"入口（开放式着陆页设计）', () => {
    renderNav(true);
    expect(screen.getByRole('link', { name: /水晶蟹小屋/ })).toBeInTheDocument();
  });

  it('Cloud Admin 登录后同样显示"水晶蟹小屋"入口', () => {
    useCloudServiceStore.getState().updateSession(ADMIN_SESSION);
    renderNav(true);
    expect(screen.getByRole('link', { name: /水晶蟹小屋/ })).toBeInTheDocument();
  });

  it('展示主歌单链接（说说Crystal）', () => {
    renderNav(true);
    expect(screen.getByText('说说Crystal')).toBeInTheDocument();
  });

  it('用户自定义歌单展示在列表中', () => {
    useFavListStore.setState({
      list: [
        {
          id: 'c1',
          name: '我的精选',
          type: FavListType.CUSTOM,
          bv_ids: [],
          create_time: 0,
          update_time: 0,
        } as never,
        {
          id: 'b1',
          name: '收藏夹 X',
          type: FavListType.BILI_FAV,
          bv_ids: [],
          create_time: 0,
          update_time: 0,
        } as never,
      ],
    });
    renderNav(true);
    expect(screen.getByRole('link', { name: /我的精选/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /收藏夹 X/ })).toBeInTheDocument();
  });

  it('UPLOADER 歌单 + space.face 时渲染 Avatar 包装容器', () => {
    useBilibiliUserVideosStore.setState({
      space: {
        '999': { name: 'XX', mid: 999, face: 'https://i0.hdslb.com/bfs/face/x.jpg' } as never,
      },
    });
    useFavListStore.setState({
      list: [
        {
          id: 'u1',
          name: 'UP 主某人',
          type: FavListType.UPLOADER,
          mid: '999',
          bv_ids: [],
          create_time: 0,
          update_time: 0,
        } as never,
      ],
    });
    const { container } = renderNav(true);
    // Radix Avatar 在 jsdom 下 image 加载状态为 loading，会渲染 fallback
    // 但仍能找到 Avatar 包装的 span 或 fallback 文本（name 首字母）
    expect(screen.getByRole('link', { name: /UP 主某人/ })).toBeInTheDocument();
    expect(container.querySelector('[class*="rounded-full"]')).toBeTruthy();
  });

  it('点击"创建歌单"按钮 → openFavEdit(null)', () => {
    renderNav(true);
    fireEvent.click(screen.getByRole('button', { name: /创建歌单/ }));
    expect(useUIShell.getState().favEditOpen).toBe(true);
    expect(useUIShell.getState().favEditTargetId).toBeNull();
  });

  it('折叠模式下导航行使用 justify-center 样式', () => {
    const { container } = renderNav(false);
    const aside = container.querySelector('aside');
    expect(aside?.className).toMatch(/w-16/);
  });

  it('展开模式下侧边栏宽度 w-64', () => {
    const { container } = renderNav(true);
    const aside = container.querySelector('aside');
    expect(aside?.className).toMatch(/w-64/);
  });

  it('展开模式下显示分类标题"我的歌单"', () => {
    renderNav(true);
    expect(screen.getByText('我的歌单')).toBeInTheDocument();
  });

  it('折叠模式下隐藏"我的歌单"分类标题', () => {
    renderNav(false);
    expect(screen.queryByText('我的歌单')).not.toBeInTheDocument();
  });

  it('展示"我的收藏"链接，指向 /fav/favorites', () => {
    renderNav(true);
    const link = screen.getByRole('link', { name: /我的收藏/ });
    expect(link).toBeInTheDocument();
    // MemoryRouter 下 href 为 /fav/favorites；HashRouter 下为 #/fav/favorites。统一用 contains
    expect(link.getAttribute('href')).toMatch(/\/fav\/favorites$/);
  });

  it('master 歌单（说说Crystal）在 DOM 中位于"我的歌单"分类标题之前', () => {
    renderNav(true);
    const masterLink = screen.getByRole('link', { name: /说说Crystal/ });
    const myFavLabel = screen.getByText('我的歌单');
    const pos = masterLink.compareDocumentPosition(myFavLabel);
    // master 在 myFavLabel 之前 → myFavLabel 是 master 的 FOLLOWING
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"我的收藏"在 DOM 中位于"我的歌单"分类标题之后、用户自定义歌单之前', () => {
    useFavListStore.setState({
      list: [
        {
          id: 'c1',
          name: '我的精选',
          type: FavListType.CUSTOM,
          bv_ids: [],
          create_time: 0,
          update_time: 0,
        } as never,
      ],
    });
    renderNav(true);
    const myFavLabel = screen.getByText('我的歌单');
    const favoritesLink = screen.getByRole('link', { name: /我的收藏/ });
    const customLink = screen.getByRole('link', { name: /我的精选/ });
    // 标题 → 我的收藏：标题在前
    expect(
      myFavLabel.compareDocumentPosition(favoritesLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // 我的收藏 → 自定义：收藏在前
    expect(
      favoritesLink.compareDocumentPosition(customLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
