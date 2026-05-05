import { render, screen, waitFor } from '@testing-library/react';
import { useBilibiliUserStore, setPlatformBridge } from '@shuoshuo-player/shared';
import App from './App';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  // App 根级守卫依赖 PlatformBridge（用于 BilibiliLoginRequired 订阅 onLoginSuccess）
  // 此处注入最小 stub，且默认让 store 进入已登录态以走主路由分支
  setPlatformBridge({
    type: 'web',
    storage: {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
    auth: {
      login: async () => {},
      logout: async () => {},
      onLoginSuccess: () => () => {},
    },
    shell: { openExternal: async () => {} },
  });
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  // 已登录态：跳过引导卡片，渲染 RouterProvider 主流程
  useBilibiliUserStore.setState({ isInited: true, isLogin: true });
});

// SPlayer 内部依赖 useMusicPlayer + Howler；直接 mock 简化
vi.mock('@/components/player/s-player', () => ({
  SPlayer: () => <div data-testid="s-player" />,
}));
// PlayerLayout 简化为透传
vi.mock('@/components/layout/player-layout', () => ({
  PlayerLayout: ({
    children,
    footer,
    overlays,
  }: {
    children: React.ReactNode;
    footer?: React.ReactNode;
    overlays?: React.ReactNode;
  }) => (
    <div data-testid="layout">
      {children}
      <footer>{footer}</footer>
      <div>{overlays}</div>
    </div>
  ),
}));
// Toaster / Dialogs 简化
vi.mock('@/components/toaster-provider', () => ({
  ToasterProvider: () => <div data-testid="toaster" />,
}));
vi.mock('@/components/dialogs/cloud-login-dialog', () => ({
  CloudLoginDialog: () => null,
}));
vi.mock('@/components/dialogs/fav-edit-dialog', () => ({
  FavEditDialog: () => null,
}));
vi.mock('@/components/dialogs/add-song-dialog', () => ({
  AddSongDialog: () => null,
}));
vi.mock('@/components/dialogs/add-to-fav-dialog', () => ({
  AddToFavDialog: () => null,
}));
vi.mock('@/components/dialogs/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

describe('App', () => {
  it('挂载不抛错（HashRouter + RouterProvider 装载）', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('渲染 PlayerLayout / SPlayer / ToasterProvider', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });
    expect(screen.getByTestId('s-player')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });
});
