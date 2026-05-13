/// <reference types="chrome" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v1 → v2 数据迁移检测/清理工具测试
 *
 * 测试矩阵：
 * - detectV1Snapshot：6 个分支
 *   1. 非扩展环境 → null
 *   2. dismiss flag = true → null
 *   3. 7 个 v1 key 全空 → null
 *   4. fav_list 有数据 → 返回 snapshot（且 cloud_service 不进入 importInput）
 *   5. lyrics 有数据 → 返回 snapshot
 *   6. bili_videos.entities 有数据 → 返回 snapshot
 * - clearV1Storage：仅删 7 个 v1 key（不删 player_data / dismissed flag）
 * - dismissV1Migration：先写 dismissed 后删 keys（顺序保证）
 */
import {
  resetPlatformBridge,
  setPlatformBridge,
  type PlatformBridge,
} from '@shuoshuo-player/shared';
import {
  V1_DISMISS_KEY,
  V1_PERSIST_KEYS,
  clearV1Storage,
  detectV1Snapshot,
  dismissV1Migration,
  resetAllStorage,
  seedV1FromExportJson,
} from './v1-migration';

interface ChromeStorageMock {
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };
}

function createChromeMock(initial: Record<string, unknown> = {}): {
  mock: ChromeStorageMock;
  store: Map<string, unknown>;
  callOrder: string[];
} {
  const store = new Map<string, unknown>(Object.entries(initial));
  const callOrder: string[] = [];
  return {
    store,
    callOrder,
    mock: {
      storage: {
        local: {
          get: vi.fn(async (keys?: string | string[]) => {
            callOrder.push('get');
            if (!keys) return Object.fromEntries(store);
            const arr = Array.isArray(keys) ? keys : [keys];
            const out: Record<string, unknown> = {};
            for (const k of arr) {
              if (store.has(k)) out[k] = store.get(k);
            }
            return out;
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            callOrder.push('set');
            for (const [k, v] of Object.entries(items)) store.set(k, v);
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            callOrder.push('remove');
            (Array.isArray(keys) ? keys : [keys]).forEach((k) => store.delete(k));
          }),
        },
      },
    },
  };
}

function createBridge(type: PlatformBridge['type']): PlatformBridge {
  return {
    type,
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
  };
}

describe('detectV1Snapshot', () => {
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    resetPlatformBridge();
  });

  afterEach(() => {
    resetPlatformBridge();
    if (originalChrome === undefined) {
      delete (globalThis as any).chrome;
    } else {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('非扩展环境（platform=web）→ null', async () => {
    setPlatformBridge(createBridge('web'));
    const { mock } = createChromeMock({ fav_list: { list: [{ id: '1' }] } });
    (globalThis as any).chrome = mock;
    expect(await detectV1Snapshot()).toBeNull();
  });

  it('chrome.storage 不存在 → null', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    delete (globalThis as any).chrome;
    expect(await detectV1Snapshot()).toBeNull();
  });

  it('dismiss flag = true → null（即使 v1 数据存在）', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock } = createChromeMock({
      [V1_DISMISS_KEY]: true,
      fav_list: { list: [{ id: '1', name: 'x', type: 0, bv_ids: [], create_time: 0 }] },
    });
    (globalThis as any).chrome = mock;
    expect(await detectV1Snapshot()).toBeNull();
  });

  it('7 个 v1 key 全空 → null', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock } = createChromeMock({});
    (globalThis as any).chrome = mock;
    expect(await detectV1Snapshot()).toBeNull();
  });

  it('fav_list 有数据 → 返回 snapshot 且 cloud_service 不进入 parsed.payload', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock } = createChromeMock({
      fav_list: {
        list: [
          {
            id: 'fav-1',
            name: '测试歌单',
            type: 0,
            mid: '0',
            bv_ids: ['BV1xx'],
            create_time: Date.now(),
          },
        ],
      },
      cloud_service: { session: { token: 'should-not-leak' } },
    });
    (globalThis as any).chrome = mock;
    const snapshot = await detectV1Snapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.parsed.favList.length).toBe(1);
    expect(snapshot!.parsed.favList[0].name).toBe('测试歌单');
    // cloud_service 应在 raw 里（备份用），但不应在 parsed.payload 任何字段中
    expect(snapshot!.raw.cloud_service).toBeDefined();
    expect(JSON.stringify(snapshot!.parsed.payload)).not.toContain('should-not-leak');
  });

  it('仅 lyrics 有数据 → 返回 snapshot', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock } = createChromeMock({
      lyrics: { lyricMaps: { BV1xx: { content: '[00:00.00]测试' } } },
    });
    (globalThis as any).chrome = mock;
    const snapshot = await detectV1Snapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.parsed.lyricCount).toBe(1);
  });

  it('仅 bili_videos.entities 有数据 → 返回 snapshot', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock } = createChromeMock({
      bili_videos: { entities: { BV1xx: { bvid: 'BV1xx', title: 't' } }, ids: ['BV1xx'] },
    });
    (globalThis as any).chrome = mock;
    const snapshot = await detectV1Snapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.parsed.videoCount).toBe(1);
  });

  it('仅 ui_profile / playing_list 等次要 key 有数据 → null（不算「有迁移价值」）', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock } = createChromeMock({
      ui_profile: { theme: 'dark' },
      playing_list: { fav_id: 'x', bv_ids: ['BV1xx'] },
    });
    (globalThis as any).chrome = mock;
    expect(await detectV1Snapshot()).toBeNull();
  });
});

describe('clearV1Storage', () => {
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    resetPlatformBridge();
  });

  afterEach(() => {
    resetPlatformBridge();
    if (originalChrome === undefined) {
      delete (globalThis as any).chrome;
    } else {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('仅删 7 个 v1 key（不动 player_data / dismissed flag）', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock, store } = createChromeMock({
      fav_list: { list: [] },
      lyrics: { lyricMaps: {} },
      cloud_service: { session: {} },
      player_data: '{"keep":"me"}',
      [V1_DISMISS_KEY]: true,
    });
    (globalThis as any).chrome = mock;
    await clearV1Storage();
    expect(store.has('fav_list')).toBe(false);
    expect(store.has('lyrics')).toBe(false);
    expect(store.has('cloud_service')).toBe(false);
    expect(store.has('player_data')).toBe(true);
    expect(store.has(V1_DISMISS_KEY)).toBe(true);
  });

  it('非扩展环境直接 no-op（不抛错）', async () => {
    setPlatformBridge(createBridge('web'));
    const { mock } = createChromeMock();
    (globalThis as any).chrome = mock;
    await expect(clearV1Storage()).resolves.toBeUndefined();
    expect(mock.storage.local.remove).not.toHaveBeenCalled();
  });
});

describe('dismissV1Migration', () => {
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    resetPlatformBridge();
  });

  afterEach(() => {
    resetPlatformBridge();
    if (originalChrome === undefined) {
      delete (globalThis as any).chrome;
    } else {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('严格按「先 set dismissed → 后 remove v1 keys」顺序执行（半失败兜底）', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock, store, callOrder } = createChromeMock({
      fav_list: { list: [{ id: 'x' }] },
      lyrics: { lyricMaps: { a: {} } },
    });
    (globalThis as any).chrome = mock;
    await dismissV1Migration();
    expect(callOrder).toEqual(['set', 'remove']);
    expect(store.get(V1_DISMISS_KEY)).toBe(true);
    for (const k of V1_PERSIST_KEYS) {
      expect(store.has(k)).toBe(false);
    }
  });

  it('非扩展环境直接 no-op', async () => {
    setPlatformBridge(createBridge('web'));
    const { mock } = createChromeMock();
    (globalThis as any).chrome = mock;
    await dismissV1Migration();
    expect(mock.storage.local.set).not.toHaveBeenCalled();
    expect(mock.storage.local.remove).not.toHaveBeenCalled();
  });
});

describe('seedV1FromExportJson（dev 工具）', () => {
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    resetPlatformBridge();
  });

  afterEach(() => {
    resetPlatformBridge();
    if (originalChrome === undefined) {
      delete (globalThis as any).chrome;
    } else {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('拣出 v1 已知 key 写入 storage + 清掉 v2 状态', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock, store } = createChromeMock({
      // 旧 v2 状态：迁移完成后应该被清，让 reload 后弹层能弹
      player_data: '{"old":"data"}',
      [V1_DISMISS_KEY]: true,
    });
    (globalThis as any).chrome = mock;

    const result = await seedV1FromExportJson({
      version: '2', // v2 导出文件可能带 version；应被忽略，不写入 storage
      fav_list: { list: [{ id: 'f1' }] },
      lyrics: { lyricMaps: { BV1: { content: 'lrc' } } },
      bili_videos: { entities: { BV1: { bvid: 'BV1' } }, ids: ['BV1'] },
      favorites: { entries: { BV1: 1 } }, // v2 新增字段，v1 没有 → 不写入
    });

    expect(result.writtenKeys.sort()).toEqual(['bili_videos', 'fav_list', 'lyrics']);
    expect(result.clearedKeys).toEqual(['player_data', V1_DISMISS_KEY]);
    expect(store.has('fav_list')).toBe(true);
    expect(store.has('lyrics')).toBe(true);
    expect(store.has('bili_videos')).toBe(true);
    expect(store.has('favorites')).toBe(false);
    expect(store.has('version')).toBe(false);
    expect(store.has('player_data')).toBe(false);
    expect(store.has(V1_DISMISS_KEY)).toBe(false);
  });

  it('JSON 不包含任何 v1 已知 key → 抛错', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    const { mock } = createChromeMock();
    (globalThis as any).chrome = mock;
    await expect(seedV1FromExportJson({ unknown: 'field' })).rejects.toThrow(/不包含任何 v1/);
  });

  it('非扩展环境抛错（守卫）', async () => {
    setPlatformBridge(createBridge('web'));
    const { mock } = createChromeMock();
    (globalThis as any).chrome = mock;
    await expect(seedV1FromExportJson({ fav_list: { list: [] } })).rejects.toThrow(/扩展环境/);
  });
});

describe('resetAllStorage（dev 工具）', () => {
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    resetPlatformBridge();
  });

  afterEach(() => {
    resetPlatformBridge();
    if (originalChrome === undefined) {
      delete (globalThis as any).chrome;
    } else {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('清空整个 chrome.storage.local', async () => {
    setPlatformBridge(createBridge('chrome-extension'));
    // mock 端用 createChromeMock 的 .clear 没实现，单独补一下：
    const { mock, store } = createChromeMock({
      player_data: '{}',
      fav_list: { list: [] },
      [V1_DISMISS_KEY]: true,
    });
    (mock.storage.local as any).clear = vi.fn(async () => {
      store.clear();
    });
    (globalThis as any).chrome = mock;
    await resetAllStorage();
    expect(store.size).toBe(0);
  });

  it('非扩展环境抛错', async () => {
    setPlatformBridge(createBridge('web'));
    const { mock } = createChromeMock();
    (globalThis as any).chrome = mock;
    await expect(resetAllStorage()).rejects.toThrow(/扩展环境/);
  });
});
