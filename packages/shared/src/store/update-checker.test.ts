import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useUpdateCheckerStore } from './update-checker';
import { setPlatformBridge, resetPlatformBridge } from '../platform';
import type { PlatformBridge } from '../types';
import type { UpdateInfo } from '../api/update';

function makeInfo(version: string): UpdateInfo {
  return {
    version,
    tag: `v${version}`,
    channel: 'beta',
    pub_date: '2026-05-15T10:30:00Z',
    release_url: `https://github.com/x/${version}`,
    notes_url: `https://github.com/x/${version}`,
  };
}

function makeBridge(getJson: (url: string) => Promise<unknown>): PlatformBridge {
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
    shell: { openExternal: vi.fn(async () => {}) },
    http: { getJson: vi.fn(getJson) },
  };
}

function reset() {
  useUpdateCheckerStore.setState({
    lastCheckedAt: null,
    latestKnown: null,
    ignoredVersions: [],
    isChecking: false,
  });
}

describe('useUpdateCheckerStore', () => {
  beforeEach(reset);
  afterEach(resetPlatformBridge);

  it('首次 check：调用 API 并写入 lastCheckedAt + latestKnown', async () => {
    const getJson = vi.fn(async () => ({
      version: '1.9.1',
      release_url: 'https://x',
    }));
    setPlatformBridge(makeBridge(getJson));

    const r = await useUpdateCheckerStore.getState().check();
    expect(r?.version).toBe('1.9.1');

    const s = useUpdateCheckerStore.getState();
    expect(s.latestKnown?.version).toBe('1.9.1');
    expect(s.lastCheckedAt).not.toBeNull();
    expect(s.isChecking).toBe(false);
  });

  it('节流：6h 内重复 check 不再调用 API', async () => {
    const getJson = vi.fn(async () => ({ version: '1.9.1', release_url: 'https://x' }));
    setPlatformBridge(makeBridge(getJson));

    await useUpdateCheckerStore.getState().check();
    expect(getJson).toHaveBeenCalledTimes(1);

    await useUpdateCheckerStore.getState().check();
    await useUpdateCheckerStore.getState().check();
    expect(getJson).toHaveBeenCalledTimes(1);
  });

  it('force=true 跳过节流强制刷新', async () => {
    const getJson = vi.fn(async () => ({ version: '1.9.1', release_url: 'https://x' }));
    setPlatformBridge(makeBridge(getJson));

    await useUpdateCheckerStore.getState().check();
    await useUpdateCheckerStore.getState().check({ force: true });
    await useUpdateCheckerStore.getState().check({ force: true });
    expect(getJson).toHaveBeenCalledTimes(3);
  });

  it('节流时间到期后再次 check 触发 API', async () => {
    vi.useFakeTimers();
    try {
      const getJson = vi.fn(async () => ({ version: '1.9.1', release_url: 'https://x' }));
      setPlatformBridge(makeBridge(getJson));

      await useUpdateCheckerStore.getState().check();
      expect(getJson).toHaveBeenCalledTimes(1);

      // 推进 6h + 1s
      vi.setSystemTime(Date.now() + 6 * 60 * 60 * 1000 + 1000);

      await useUpdateCheckerStore.getState().check();
      expect(getJson).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('网络失败保留旧 latestKnown，仅刷新 lastCheckedAt（避免 6h 内反复重试）', async () => {
    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: makeInfo('1.9.0'),
      ignoredVersions: [],
      isChecking: false,
    });

    const getJson = vi.fn(async () => {
      throw new Error('network down');
    });
    setPlatformBridge(makeBridge(getJson));

    const r = await useUpdateCheckerStore.getState().check({ force: true });
    expect(r).toBeNull();

    const s = useUpdateCheckerStore.getState();
    expect(s.latestKnown?.version).toBe('1.9.0'); // 旧值保留
    expect(s.lastCheckedAt).not.toBeNull();
    expect(s.isChecking).toBe(false);
  });

  it('ignoreVersion 加入忽略列表，重复 ignore 同版本不重复', () => {
    useUpdateCheckerStore.getState().ignoreVersion('1.9.1');
    useUpdateCheckerStore.getState().ignoreVersion('1.9.1');
    useUpdateCheckerStore.getState().ignoreVersion('1.9.2');
    expect(useUpdateCheckerStore.getState().ignoredVersions).toEqual(['1.9.1', '1.9.2']);
  });

  it('clearIgnored 清空忽略列表', () => {
    useUpdateCheckerStore.setState({
      lastCheckedAt: null,
      latestKnown: null,
      ignoredVersions: ['1.9.1', '1.9.2'],
      isChecking: false,
    });
    useUpdateCheckerStore.getState().clearIgnored();
    expect(useUpdateCheckerStore.getState().ignoredVersions).toEqual([]);
  });

  it('persistSnapshot 仅返回持久化字段，丢掉 isChecking', () => {
    useUpdateCheckerStore.setState({
      lastCheckedAt: '2026-05-10T12:00:00Z',
      latestKnown: makeInfo('1.9.1'),
      ignoredVersions: ['1.9.0'],
      isChecking: true,
    });
    const snap = useUpdateCheckerStore.getState().persistSnapshot();
    expect(snap).toEqual({
      lastCheckedAt: '2026-05-10T12:00:00Z',
      latestKnown: makeInfo('1.9.1'),
      ignoredVersions: ['1.9.0'],
    });
    expect((snap as { isChecking?: boolean }).isChecking).toBeUndefined();
  });

  it('isChecking 期间二次调用直接返回当前 latestKnown 不再发请求', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const getJson = vi.fn(async () => firstPromise);
    setPlatformBridge(makeBridge(getJson));

    const p1 = useUpdateCheckerStore.getState().check();
    // 第一次还在飞，第二次立即调用应该不再触发 fetch
    const p2 = useUpdateCheckerStore.getState().check({ force: true });
    expect(getJson).toHaveBeenCalledTimes(1);

    resolveFirst({ version: '1.9.1', release_url: 'https://x' });
    await Promise.all([p1, p2]);
  });
});
