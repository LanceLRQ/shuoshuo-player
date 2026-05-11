import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchLatestVersion, __TEST_ONLY__ } from './update';
import type { UpdateInfo } from './update';
import { setPlatformBridge, resetPlatformBridge } from '../platform';
import type { PlatformBridge } from '../types';

const { parseUpdateInfo, parseGithubRelease, PRIMARY_ENDPOINT, FALLBACK_ENDPOINT } = __TEST_ONLY__;

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
    shell: {
      openExternal: vi.fn(async () => {}),
    },
    http: {
      getJson: vi.fn(getJson),
    },
  };
}

describe('parseUpdateInfo (镜像 version.json 格式)', () => {
  it('合法 payload 解析成功', () => {
    const raw = {
      version: '1.9.1',
      tag: 'v1.9.1',
      channel: 'beta',
      pub_date: '2026-05-15T10:30:00Z',
      release_url: 'https://github.com/LanceLRQ/shuoshuo-player/releases/tag/v1.9.1',
      notes_url: 'https://github.com/LanceLRQ/shuoshuo-player/releases/tag/v1.9.1',
    };
    expect(parseUpdateInfo(raw)).toEqual<UpdateInfo>({
      version: '1.9.1',
      tag: 'v1.9.1',
      channel: 'beta',
      pub_date: '2026-05-15T10:30:00Z',
      release_url: 'https://github.com/LanceLRQ/shuoshuo-player/releases/tag/v1.9.1',
      notes_url: 'https://github.com/LanceLRQ/shuoshuo-player/releases/tag/v1.9.1',
    });
  });

  it('缺 tag 时按 version 自动派生', () => {
    const r = parseUpdateInfo({
      version: '1.9.1',
      release_url: 'https://example.com',
    });
    expect(r?.tag).toBe('v1.9.1');
  });

  it('缺 notes_url 时 fallback 到 release_url', () => {
    const r = parseUpdateInfo({
      version: '1.9.1',
      release_url: 'https://example.com',
    });
    expect(r?.notes_url).toBe('https://example.com');
  });

  it('channel 缺失时 1.x 推断为 beta，2.x 推断为 stable', () => {
    expect(parseUpdateInfo({ version: '1.9.0', release_url: 'https://x' })?.channel).toBe('beta');
    expect(parseUpdateInfo({ version: '2.0.0', release_url: 'https://x' })?.channel).toBe('stable');
  });

  it.each([
    [null, 'null 输入'],
    [undefined, 'undefined 输入'],
    ['not-an-object', '字符串输入'],
    [{ version: 'abc', release_url: 'x' }, '非法版本号'],
    [{ version: '1.9.0' }, '缺 release_url'],
    [{ release_url: 'x' }, '缺 version'],
  ] as const)('非法 payload (%s) 返回 null', (raw, _label) => {
    expect(parseUpdateInfo(raw)).toBeNull();
  });
});

describe('parseGithubRelease (GitHub API 格式)', () => {
  it('合法 release 解析成功', () => {
    const raw = {
      tag_name: 'v1.9.1',
      html_url: 'https://github.com/LanceLRQ/shuoshuo-player/releases/tag/v1.9.1',
      published_at: '2026-05-15T10:30:00Z',
      prerelease: true,
    };
    const r = parseGithubRelease(raw);
    expect(r?.version).toBe('1.9.1');
    expect(r?.tag).toBe('v1.9.1');
    expect(r?.channel).toBe('beta');
    expect(r?.pub_date).toBe('2026-05-15T10:30:00Z');
  });

  it('prerelease=false 但版本是 1.x 仍按版本推断为 beta', () => {
    const r = parseGithubRelease({
      tag_name: 'v1.9.1',
      html_url: 'https://x',
      prerelease: false,
    });
    expect(r?.channel).toBe('beta');
  });

  it('prerelease=true 强制 beta（即使版本是 2.x）', () => {
    const r = parseGithubRelease({
      tag_name: 'v2.0.0',
      html_url: 'https://x',
      prerelease: true,
    });
    expect(r?.channel).toBe('beta');
  });

  it('缺 tag_name 返回 null', () => {
    expect(parseGithubRelease({ html_url: 'x' })).toBeNull();
  });

  it('缺 html_url 返回 null', () => {
    expect(parseGithubRelease({ tag_name: 'v1.0.0' })).toBeNull();
  });

  it('非法版本号 tag 返回 null', () => {
    expect(parseGithubRelease({ tag_name: 'invalid', html_url: 'x' })).toBeNull();
  });
});

describe('fetchLatestVersion', () => {
  afterEach(() => {
    resetPlatformBridge();
  });

  it('主端点成功直接返回，不调用 fallback', async () => {
    const getJson = vi.fn(async (url: string) => {
      if (url === PRIMARY_ENDPOINT) {
        return {
          version: '1.9.1',
          tag: 'v1.9.1',
          channel: 'beta',
          pub_date: '2026-05-15T10:30:00Z',
          release_url: 'https://github.com/x',
          notes_url: 'https://github.com/x',
        };
      }
      throw new Error('should not reach fallback');
    });
    setPlatformBridge(makeBridge(getJson));

    const r = await fetchLatestVersion();
    expect(r?.version).toBe('1.9.1');
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(getJson).toHaveBeenCalledWith(PRIMARY_ENDPOINT, expect.anything());
  });

  it('主端点失败时 fallback GitHub API', async () => {
    const getJson = vi.fn(async (url: string) => {
      if (url === PRIMARY_ENDPOINT) throw new Error('network error');
      if (url === FALLBACK_ENDPOINT) {
        return {
          tag_name: 'v1.9.1',
          html_url: 'https://github.com/x',
          published_at: '2026-05-15T10:30:00Z',
          prerelease: true,
        };
      }
      return null;
    });
    setPlatformBridge(makeBridge(getJson));

    const r = await fetchLatestVersion();
    expect(r?.version).toBe('1.9.1');
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it('主端点返回非法 JSON 也 fallback', async () => {
    const getJson = vi.fn(async (url: string) => {
      if (url === PRIMARY_ENDPOINT) return { garbage: true };
      if (url === FALLBACK_ENDPOINT) {
        return {
          tag_name: 'v1.9.1',
          html_url: 'https://github.com/x',
          prerelease: true,
        };
      }
      return null;
    });
    setPlatformBridge(makeBridge(getJson));

    const r = await fetchLatestVersion();
    expect(r?.version).toBe('1.9.1');
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it('两个端点都失败返回 null', async () => {
    const getJson = vi.fn(async () => {
      throw new Error('all dead');
    });
    setPlatformBridge(makeBridge(getJson));

    const r = await fetchLatestVersion();
    expect(r).toBeNull();
  });

  it('PlatformBridge 没有 http 字段时静默返回 null', async () => {
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
        onLoginSuccess: vi.fn(() => () => {}),
      },
      shell: { openExternal: vi.fn(async () => {}) },
      // 故意不注入 http
    });

    const r = await fetchLatestVersion();
    expect(r).toBeNull();
  });
});
