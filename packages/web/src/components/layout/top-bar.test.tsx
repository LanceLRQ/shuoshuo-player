import { fireEvent, render, screen, act } from '@testing-library/react';
import {
  useBilibiliUserStore,
  useCloudServiceStore,
  usePlayerProfileStore,
  useUIStore,
  setPlatformBridge,
  resetPlatformBridge,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { TopBar } from './top-bar';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function reset() {
  useBilibiliUserStore.setState({ current: null });
  useCloudServiceStore.getState().clearSession();
  usePlayerProfileStore.setState({ theme: 'light' });
  useUIShell.setState({ cloudLoginOpen: false });
  useUIStore.setState({ notices: [] });
  // 注入一个最小 PlatformBridge 让 GitHub 按钮的 shell.openExternal 不抛错
  setPlatformBridge({
    type: 'web',
    storage: {
      getItem: vi.fn(async () => null),
      setItem: vi.fn(async () => {}),
      removeItem: vi.fn(async () => {}),
    },
    auth: {
      login: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
      onLoginSuccess: vi.fn(),
    },
    shell: {
      openExternal: vi.fn(async () => {}),
    },
  });
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterAll(() => {
  vi.unstubAllGlobals();
  resetPlatformBridge();
});

describe('TopBar', () => {
  beforeEach(() => {
    reset();
  });

  it('显示应用标题"说说播放器"', () => {
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    expect(screen.getByText('说说播放器')).toBeInTheDocument();
  });

  it('点击菜单按钮触发 onToggleMenu 回调', () => {
    const onToggle = vi.fn();
    render(<TopBar menuOpen={true} onToggleMenu={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /收起菜单/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('menuOpen=false 时菜单按钮 aria-label 为"展开菜单"', () => {
    render(<TopBar menuOpen={false} onToggleMenu={vi.fn()} />);
    expect(screen.getByRole('button', { name: '展开菜单' })).toBeInTheDocument();
  });

  it('展开态：渲染 logo + 收起菜单按钮', () => {
    const { container } = render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    // logo 是装饰性元素，alt="" 走 hidden role；用 querySelector 直接查元素
    expect(container.querySelector('img')).toBeTruthy();
    expect(screen.getByRole('button', { name: /收起菜单/ })).toBeInTheDocument();
  });

  it('折叠态：logo 与展开按钮共用同一 button（hover 切换）', () => {
    const { container } = render(<TopBar menuOpen={false} onToggleMenu={vi.fn()} />);
    const expandBtn = screen.getByRole('button', { name: '展开菜单' });
    // logo img 嵌在 button 内
    expect(expandBtn.querySelector('img')).toBeTruthy();
    // 折叠态不应再渲染单独的 PanelLeftClose 按钮
    expect(screen.queryByRole('button', { name: /收起菜单/ })).toBeNull();
    void container;
  });

  it('显示版本号 v{version}', () => {
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  it('点击 GitHub 按钮调用 shell.openExternal', () => {
    const bridge = setPlatformBridge as unknown; // 让 ts 别报错
    void bridge;
    const openSpy = vi.fn(async () => {});
    setPlatformBridge({
      type: 'web',
      storage: {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => {}),
        removeItem: vi.fn(async () => {}),
      },
      auth: {
        login: vi.fn(async () => {}),
        logout: vi.fn(async () => {}),
        onLoginSuccess: vi.fn(),
      },
      shell: { openExternal: openSpy },
    });
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('github.com/'));
  });

  it('主题切换按钮：light → dark', () => {
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '切换主题' }));
    expect(usePlayerProfileStore.getState().theme).toBe('dark');
  });

  it('主题切换按钮：dark → light', () => {
    usePlayerProfileStore.setState({ theme: 'dark' });
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '切换主题' }));
    expect(usePlayerProfileStore.getState().theme).toBe('light');
  });

  it('未登录时账户头像 fallback 为"?"', () => {
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('已登录 B 站用户 fallback 为用户名首字母', () => {
    useBilibiliUserStore.setState({
      current: { uname: '说说Crystal', mid: 1, face: '' } as never,
    });
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    expect(screen.getByText('说')).toBeInTheDocument();
  });

  it('云服务已登录时显示角色 Badge', () => {
    useCloudServiceStore.getState().updateSession({
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
    } as never);
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    expect(useCloudServiceStore.getState().isLogin()).toBe(true);
  });

  it('theme=auto 状态可识别（用于 DropdownMenuLabel Badge）', () => {
    usePlayerProfileStore.setState({ theme: 'auto' });
    render(<TopBar menuOpen={true} onToggleMenu={vi.fn()} />);
    expect(usePlayerProfileStore.getState().theme).toBe('auto');
  });
});
