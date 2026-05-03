import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePlayerProfileStore } from '@shuoshuo-player/shared';
import { PlayerLayout } from './player-layout';
import { useUIShell } from '@/stores/ui-shell';

// nav-menu / top-bar 内部依赖较多，简单 stub 让 layout 测试聚焦在主结构
vi.mock('./top-bar', () => ({
  TopBar: ({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) => (
    <header data-testid="topbar" data-open={menuOpen} onClick={onToggleMenu}>
      TopBar
    </header>
  ),
}));
vi.mock('./nav-menu', () => ({
  NavMenu: ({ menuOpen }: { menuOpen: boolean }) => (
    <nav data-testid="navmenu" data-open={menuOpen}>
      NavMenu
    </nav>
  ),
}));

function reset() {
  useUIShell.setState({ menuOpen: true });
  usePlayerProfileStore.setState({ theme: 'light' });
  document.documentElement.classList.remove('dark');
}

function renderLayout(ui: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  overlays?: React.ReactNode;
}) {
  return render(
    <MemoryRouter>
      <PlayerLayout {...ui} />
    </MemoryRouter>,
  );
}

describe('PlayerLayout', () => {
  beforeEach(() => {
    reset();
  });

  it('渲染 TopBar / NavMenu / children / footer / overlays', () => {
    renderLayout({
      children: <div data-testid="content">Main</div>,
      footer: <div data-testid="footer">Footer</div>,
      overlays: <div data-testid="overlay">Overlay</div>,
    });

    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('navmenu')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('overlay')).toBeInTheDocument();
  });

  it('menuOpen=true 时 main 容器使用 ml-64 缩进', () => {
    const { container } = renderLayout({ children: 'x' });
    const main = container.querySelector('main');
    expect(main?.className).toMatch(/ml-64/);
  });

  it('menuOpen=false 时 main 容器使用 ml-16 缩进', () => {
    useUIShell.setState({ menuOpen: false });
    const { container } = renderLayout({ children: 'x' });
    const main = container.querySelector('main');
    expect(main?.className).toMatch(/ml-16/);
  });

  it('theme=dark 时 documentElement 添加 dark class', () => {
    usePlayerProfileStore.setState({ theme: 'dark' });
    renderLayout({ children: 'x' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('theme=light 时 documentElement 不含 dark class', () => {
    usePlayerProfileStore.setState({ theme: 'light' });
    renderLayout({ children: 'x' });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('theme 变化触发 className 切换', () => {
    renderLayout({ children: 'x' });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => {
      usePlayerProfileStore.setState({ theme: 'dark' });
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('theme=auto 时订阅 matchMedia change 事件', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const matchMediaSpy = vi.fn(() => ({
      matches: false,
      addEventListener: addListener,
      removeEventListener: removeListener,
    }));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaSpy,
    });

    usePlayerProfileStore.setState({
      theme: 'auto',
      getEffectiveTheme: () => 'light',
    });
    const { unmount } = renderLayout({ children: 'x' });

    expect(addListener).toHaveBeenCalledWith('change', expect.any(Function));
    unmount();
    expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
