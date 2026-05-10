import { fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import {
  useUpdateCheckerStore,
  useUIStore,
  setPlatformBridge,
  resetPlatformBridge,
} from '@shuoshuo-player/shared';
import type { UpdateInfo, PlatformBridge } from '@shuoshuo-player/shared';
import { AboutSettings } from './about';

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

function makeInfo(version: string): UpdateInfo {
  return {
    version,
    tag: `v${version}`,
    channel: version.startsWith('1.') ? 'beta' : 'stable',
    pub_date: '2026-05-15T10:30:00Z',
    release_url: `https://github.com/x/${version}`,
    notes_url: `https://github.com/x/${version}`,
  };
}

function makeBridge(
  openSpy: ReturnType<typeof vi.fn>,
  getJson?: ReturnType<typeof vi.fn>,
): PlatformBridge {
  return {
    type: 'web',
    storage: {
      getItem: vi.fn(async () => null),
      setItem: vi.fn(async () => {}),
      removeItem: vi.fn(async () => {}),
    },
    auth: {
      login: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
      onLoginSuccess: vi.fn(() => () => {}),
    },
    shell: { openExternal: openSpy },
    http: getJson ? { getJson } : undefined,
  };
}

beforeEach(() => {
  useUpdateCheckerStore.setState({
    lastCheckedAt: null,
    latestKnown: null,
    ignoredVersions: [],
    isChecking: false,
  });
  useUIStore.setState({ notices: [] });
});

afterEach(() => {
  resetPlatformBridge();
});

describe('AboutSettings', () => {
  it('显示当前版本号 v{APP_VERSION}', () => {
    setPlatformBridge(makeBridge(vi.fn(async () => {})));
    render(<AboutSettings />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  it('1.x 版本显示 Beta 徽章', () => {
    setPlatformBridge(makeBridge(vi.fn(async () => {})));
    render(<AboutSettings />);
    // APP_VERSION 编译期为 1.9.0，应该显示 Beta
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('从未检查时显示"从未检查"', () => {
    setPlatformBridge(makeBridge(vi.fn(async () => {})));
    render(<AboutSettings />);
    expect(screen.getByText(/从未检查/)).toBeInTheDocument();
  });

  it('点击"立即检查"触发 store.check(force=true)', async () => {
    const getJson = vi.fn(async () => ({
      version: '9.0.0',
      release_url: 'https://github.com/x/9.0.0',
    }));
    setPlatformBridge(
      makeBridge(
        vi.fn(async () => {}),
        getJson,
      ),
    );

    render(<AboutSettings />);
    const btn = screen.getByRole('button', { name: /立即检查更新/ });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(getJson).toHaveBeenCalled();
    expect(useUpdateCheckerStore.getState().lastCheckedAt).not.toBeNull();
  });

  it('已是最新时手动检查后显示"你已经是最新版本"', async () => {
    // mock 返回当前版本（无新版）—— APP_VERSION 是 1.9.0，返回 1.0.0（更旧）即可
    const getJson = vi.fn(async () => ({
      version: '1.0.0',
      release_url: 'https://github.com/x/1.0.0',
    }));
    setPlatformBridge(
      makeBridge(
        vi.fn(async () => {}),
        getJson,
      ),
    );

    render(<AboutSettings />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /立即检查更新/ }));
    });

    await waitFor(() => {
      expect(screen.getByText('你已经是最新版本')).toBeInTheDocument();
    });
  });

  it('有新版时显示"查看详情"按钮，点击触发 openExternal + ignoreVersion', async () => {
    const openSpy = vi.fn(async () => {});
    setPlatformBridge(makeBridge(openSpy));

    useUpdateCheckerStore.setState({
      lastCheckedAt: '2026-05-10T00:00:00Z',
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<AboutSettings />);

    const viewBtn = screen.getByRole('button', { name: /查看详情/ });
    await act(async () => {
      fireEvent.click(viewBtn);
    });

    expect(openSpy).toHaveBeenCalledWith('https://github.com/x/9.0.0');
    expect(useUpdateCheckerStore.getState().ignoredVersions).toContain('9.0.0');
  });

  it('点"忽略此版本"调用 ignoreVersion 并发 toast', async () => {
    setPlatformBridge(makeBridge(vi.fn(async () => {})));

    useUpdateCheckerStore.setState({
      lastCheckedAt: '2026-05-10T00:00:00Z',
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<AboutSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /忽略此版本/ }));
    });

    expect(useUpdateCheckerStore.getState().ignoredVersions).toContain('9.0.0');
    expect(useUIStore.getState().notices.length).toBeGreaterThan(0);
  });

  it('点击"GitHub 主页"调用 openExternal', async () => {
    const openSpy = vi.fn(async () => {});
    setPlatformBridge(makeBridge(openSpy));

    render(<AboutSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /GitHub 主页/ }));
    });

    expect(openSpy).toHaveBeenCalledWith('https://github.com/LanceLRQ/shuoshuo-player');
  });
});
