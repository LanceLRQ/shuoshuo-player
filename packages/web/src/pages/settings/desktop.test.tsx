import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_CLOSE_ACTION,
  DEFAULT_FLOATING_LYRICS,
  detectPlatformType,
  resetPlatformBridge,
  setPlatformBridge,
  usePlayerProfileStore,
  type AudioCacheStats,
} from '@shuoshuo-player/shared';
import { DesktopSettings } from './desktop';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    detectPlatformType: vi.fn(() => 'tauri'),
  };
});

const mockedDetect = vi.mocked(detectPlatformType);

// Radix Slider（CacheSettings 中使用）依赖 ResizeObserver，jsdom 默认未实现
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

const STATS: AudioCacheStats = {
  current_bytes: 0,
  max_bytes: 1024 * 1024 * 1024,
  entry_count: 0,
};

function injectTauriBridge() {
  setPlatformBridge({
    type: 'tauri',
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
    audioCache: {
      getStats: async () => STATS,
      setMaxBytes: async () => STATS,
      clear: async () => {},
      getDir: async () => '/tmp/audio-cache',
      setDir: async () => {},
      pickDir: async () => null,
    },
  });
}

function resetStore() {
  usePlayerProfileStore.setState({
    theme: 'auto',
    volume: 0.8,
    autoPlay: false,
    loopMode: 'loop',
    floatingLyrics: { ...DEFAULT_FLOATING_LYRICS },
    closeAction: DEFAULT_CLOSE_ACTION,
    closeActionFirstRunPrompted: true,
  });
}

describe('DesktopSettings', () => {
  beforeEach(() => {
    resetStore();
    mockedDetect.mockReturnValue('tauri');
    injectTauriBridge();
  });

  afterEach(() => {
    resetPlatformBridge();
  });

  it('非 Tauri 平台仅渲染占位卡片', () => {
    mockedDetect.mockReturnValue('web');
    render(<DesktopSettings />);
    expect(screen.getByText(/只在桌面端有效/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /隐藏到托盘/ })).not.toBeInTheDocument();
  });

  it('Tauri 平台渲染两个选项 + 当前 closeAction 默认选中 minimize-to-tray', () => {
    render(<DesktopSettings />);
    const trayRadio = screen.getByRole('radio', { name: /隐藏到托盘/ });
    const exitRadio = screen.getByRole('radio', { name: /直接退出应用/ });
    expect(trayRadio.getAttribute('data-state')).toBe('checked');
    expect(exitRadio.getAttribute('data-state')).toBe('unchecked');
  });

  it('合并后包含音频缓存分组（标题与子分区可见）', () => {
    render(<DesktopSettings />);
    expect(screen.getByText('音频缓存')).toBeInTheDocument();
    expect(screen.getByText('容量上限')).toBeInTheDocument();
    expect(screen.getByText('缓存目录')).toBeInTheDocument();
  });

  it('切换到"直接退出"立刻写入 store', async () => {
    const user = userEvent.setup();
    render(<DesktopSettings />);
    await user.click(screen.getByRole('radio', { name: /直接退出应用/ }));
    expect(usePlayerProfileStore.getState().closeAction).toBe('exit');
  });

  it('Store 已是 exit 时进入页面：exit 选项预选中', () => {
    act(() => {
      usePlayerProfileStore.setState({ closeAction: 'exit' });
    });
    render(<DesktopSettings />);
    expect(screen.getByRole('radio', { name: /直接退出应用/ }).getAttribute('data-state')).toBe(
      'checked',
    );
  });
});
