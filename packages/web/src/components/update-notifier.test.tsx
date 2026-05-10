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

beforeEach(() => {
  resetStores();
  setPlatformBridge(makeBridge(vi.fn(async () => {})));
});

afterEach(() => {
  resetPlatformBridge();
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
});
