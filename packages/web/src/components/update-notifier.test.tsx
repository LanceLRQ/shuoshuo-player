import { render, act } from '@testing-library/react';
import {
  useUpdateCheckerStore,
  useUIStore,
  setPlatformBridge,
  resetPlatformBridge,
} from '@shuoshuo-player/shared';
import type { UpdateInfo, PlatformBridge } from '@shuoshuo-player/shared';
import { UpdateNotifier } from './update-notifier';

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

function makeBridge(openSpy: ReturnType<typeof vi.fn>): PlatformBridge {
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
  };
}

function resetStores() {
  useUpdateCheckerStore.setState({
    lastCheckedAt: null,
    latestKnown: null,
    ignoredVersions: [],
    isChecking: false,
  });
  useUIStore.setState({ notices: [] });
}

// detectPlatformType 通过 window 上的标记区分平台；测试里按需注入，afterEach 清理
function setPlatform(kind: 'chrome-extension' | 'tauri') {
  const w = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    chrome?: { runtime?: { id?: string } };
  };
  if (kind === 'tauri') w.__TAURI_INTERNALS__ = {};
  if (kind === 'chrome-extension') w.chrome = { runtime: { id: 'test-ext-id' } };
}

beforeEach(() => {
  resetStores();
  setPlatformBridge(makeBridge(vi.fn(async () => {})));
});

afterEach(() => {
  resetPlatformBridge();
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; chrome?: unknown };
  delete w.__TAURI_INTERNALS__;
  delete w.chrome;
  window.location.hash = '';
});

describe('UpdateNotifier', () => {
  it('latestKnown 比当前 APP_VERSION 新时弹 toast', () => {
    // __APP_VERSION__ 编译期注入为根 package.json 的 version（当前 1.9.0）
    // 用 9.0.0 模拟"新版本"
    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    const notices = useUIStore.getState().notices;
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toContain('v9.0.0');
    expect(notices[0].action?.label).toBe('查看更新');
    expect(notices[0].duration).toBeNull();
  });

  it('latestKnown 与当前版本相同时不弹 toast', () => {
    // 当前 APP_VERSION 是 1.9.0，构造同版本
    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('1.9.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    expect(useUIStore.getState().notices).toHaveLength(0);
  });

  it('latestKnown 已在 ignoredVersions 中时不弹 toast', () => {
    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: ['9.0.0'],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    expect(useUIStore.getState().notices).toHaveLength(0);
  });

  it('latestKnown 为 null 时不弹 toast', () => {
    render(<UpdateNotifier />);
    expect(useUIStore.getState().notices).toHaveLength(0);
  });

  it('action.onClick 触发 openExternal + ignoreVersion + removeNotice', async () => {
    const openSpy = vi.fn(async () => {});
    setPlatformBridge(makeBridge(openSpy));

    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    const notice = useUIStore.getState().notices[0];
    expect(notice).toBeDefined();

    await act(async () => {
      notice.action?.onClick();
    });

    expect(openSpy).toHaveBeenCalledWith('https://github.com/x/9.0.0');
    expect(useUpdateCheckerStore.getState().ignoredVersions).toContain('9.0.0');
    expect(useUIStore.getState().notices).toHaveLength(0);
  });

  it('同一版本不会重复弹 toast', () => {
    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    const { rerender } = render(<UpdateNotifier />);
    expect(useUIStore.getState().notices).toHaveLength(1);

    // 业务上同 store 触发 rerender，不应再弹
    act(() => {
      useUpdateCheckerStore.setState({ lastCheckedAt: new Date().toISOString() });
    });
    rerender(<UpdateNotifier />);

    expect(useUIStore.getState().notices).toHaveLength(1);
  });

  it('Chrome 扩展平台：弹双按钮（Chrome 商店 + 国内下载），首项跳商店', async () => {
    const openSpy = vi.fn(async () => {});
    setPlatformBridge(makeBridge(openSpy));
    setPlatform('chrome-extension');

    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    const notice = useUIStore.getState().notices[0];
    expect(notice).toBeDefined();
    expect(notice.action).toBeNull();
    expect(notice.actions).toHaveLength(2);
    expect(notice.actions?.[0].label).toBe('Chrome 商店');
    expect(notice.actions?.[1].label).toBe('国内下载');

    await act(async () => {
      notice.actions?.[0].onClick();
    });

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('chromewebstore.google.com'));
    // 点击任一按钮 = 隐式忽略 + 移除提示
    expect(useUpdateCheckerStore.getState().ignoredVersions).toContain('9.0.0');
    expect(useUIStore.getState().notices).toHaveLength(0);
  });

  it('Chrome 扩展平台：次按钮「国内下载」跳官方发布页', async () => {
    const openSpy = vi.fn(async () => {});
    setPlatformBridge(makeBridge(openSpy));
    setPlatform('chrome-extension');

    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    const notice = useUIStore.getState().notices[0];
    await act(async () => {
      notice.actions?.[1].onClick();
    });

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('shuoshuo.sikong.ren/player'));
  });

  it('桌面端平台：弹双按钮（查看详情 + 发布页），首项导航关于页', async () => {
    const openSpy = vi.fn(async () => {});
    setPlatformBridge(makeBridge(openSpy));
    setPlatform('tauri');

    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    const notice = useUIStore.getState().notices[0];
    expect(notice.actions).toHaveLength(2);
    expect(notice.actions?.[0].label).toBe('查看详情');
    expect(notice.actions?.[1].label).toBe('发布页');

    await act(async () => {
      notice.actions?.[0].onClick();
    });

    expect(window.location.hash).toBe('#/settings?tab=about');
    expect(useUIStore.getState().notices).toHaveLength(0);
  });

  it('桌面端平台：发布页按钮跳 GitHub release_url', async () => {
    const openSpy = vi.fn(async () => {});
    setPlatformBridge(makeBridge(openSpy));
    setPlatform('tauri');

    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('9.0.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    render(<UpdateNotifier />);

    const notice = useUIStore.getState().notices[0];
    await act(async () => {
      notice.actions?.[1].onClick();
    });

    expect(openSpy).toHaveBeenCalledWith('https://github.com/x/9.0.0');
  });
});
