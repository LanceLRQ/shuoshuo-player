import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  setPlatformBridge,
  resetPlatformBridge,
  useUIStore,
  type AudioCacheAdapter,
  type AudioCacheStats,
} from '@shuoshuo-player/shared';
import { CacheSettings } from './cache';

// Radix Slider 依赖 ResizeObserver，jsdom 默认未实现
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterAll(() => vi.unstubAllGlobals());

const STATS: AudioCacheStats = {
  current_bytes: 50 * 1024 * 1024,
  max_bytes: 1024 * 1024 * 1024,
  entry_count: 12,
};

function makeAudioCache(over: Partial<AudioCacheAdapter> = {}): AudioCacheAdapter {
  return {
    getStats: vi.fn(async () => STATS),
    setMaxBytes: vi.fn(async () => STATS),
    clear: vi.fn(async () => {}),
    getDir: vi.fn(async () => '/Users/test/Library/Caches/test/audio'),
    setDir: vi.fn(async () => {}),
    pickDir: vi.fn(async () => null),
    ...over,
  };
}

function injectBridge(audioCache?: AudioCacheAdapter) {
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
    audioCache,
  });
}

describe('CacheSettings', () => {
  beforeEach(() => {
    useUIStore.setState({ notices: [] });
  });
  afterEach(() => {
    resetPlatformBridge();
  });

  it('bridge 无 audioCache 时显示降级提示', () => {
    injectBridge(undefined);
    render(<CacheSettings />);
    expect(screen.getByText(/缓存管理仅在桌面端可用/)).toBeInTheDocument();
  });

  it('加载完成后显示用量、上限、条目数、当前路径', async () => {
    const cache = makeAudioCache();
    injectBridge(cache);
    render(<CacheSettings />);
    await waitFor(() => {
      expect(screen.getByText('50.0 MB / 1.00 GB')).toBeInTheDocument();
    });
    expect(screen.getByText('缓存条目：12')).toBeInTheDocument();
    expect(screen.getByText('/Users/test/Library/Caches/test/audio')).toBeInTheDocument();
    expect(cache.getStats).toHaveBeenCalled();
    expect(cache.getDir).toHaveBeenCalled();
  });

  it('点击「选择目录」用户取消 → 不调用 setDir', async () => {
    const cache = makeAudioCache({ pickDir: vi.fn(async () => null) });
    injectBridge(cache);
    const user = userEvent.setup();
    render(<CacheSettings />);
    await waitFor(() => {
      expect(screen.getByText(/Caches\/test\/audio/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /选择目录/ }));
    expect(cache.setDir).not.toHaveBeenCalled();
  });

  it('点击「选择目录」选了新路径 → setDir 被调 + 通知', async () => {
    const cache = makeAudioCache({
      pickDir: vi.fn(async () => '/Users/test/MyAudioCache'),
    });
    injectBridge(cache);
    const user = userEvent.setup();
    render(<CacheSettings />);
    await waitFor(() => {
      expect(screen.getByText(/Caches\/test\/audio/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /选择目录/ }));
    await waitFor(() => {
      expect(cache.setDir).toHaveBeenCalledWith('/Users/test/MyAudioCache');
    });
    expect(useUIStore.getState().notices.length).toBeGreaterThan(0);
  });

  it('点击「恢复默认」 → setDir(null)', async () => {
    const cache = makeAudioCache();
    injectBridge(cache);
    const user = userEvent.setup();
    render(<CacheSettings />);
    await waitFor(() => {
      expect(screen.getByText(/Caches\/test\/audio/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /恢复默认/ }));
    await waitFor(() => {
      expect(cache.setDir).toHaveBeenCalledWith(null);
    });
  });

  it('点击「清空全部缓存」二次确认 → 调用 clear + refresh', async () => {
    const cache = makeAudioCache();
    injectBridge(cache);
    const user = userEvent.setup();
    render(<CacheSettings />);
    await waitFor(() => {
      expect(screen.getByText('缓存条目：12')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /清空全部缓存/ }));
    // 进入二次确认态
    await user.click(screen.getByRole('button', { name: /确认清空/ }));
    await waitFor(() => {
      expect(cache.clear).toHaveBeenCalled();
    });
  });
});
