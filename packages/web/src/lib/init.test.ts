/// <reference types="chrome" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * F2: web/lib/init.test.ts
 *
 * 验证 initializeApp() 的关键行为：
 * - baseURL 优先恢复（早于云服务调用）
 * - bili_user_videos.isLoading 强制为 false
 * - 各 store 状态从 ssp_v2_player_data 中恢复
 * - 7 个 store subscribe 自动持久化
 * - apiBaseUrl 走独立 storage key 即时写入
 * - chrome.runtime.onMessage 接收 wbi:refresh 消息后调 getLoginUserInfo
 *
 * 用 vi.resetModules + 动态 import 让每个 test 都拿到独立的 store / init 模块，
 * 避免单例污染。
 */

interface ChromeRuntimeMessageListener {
  (msg: unknown, sender: unknown, sendResponse: (resp?: unknown) => void): void;
}

interface ChromeMock {
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };
  runtime: {
    id: string;
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      _listeners: ChromeRuntimeMessageListener[];
    };
  };
}

function installChromeMock(initial: Record<string, unknown> = {}): ChromeMock {
  const storage = new Map<string, unknown>(Object.entries(initial));
  const listeners: ChromeRuntimeMessageListener[] = [];

  const mock: ChromeMock = {
    storage: {
      local: {
        get: vi.fn(async (keys?: string | string[]) => {
          if (!keys) return Object.fromEntries(storage);
          const arr = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const k of arr) {
            if (storage.has(k)) out[k] = storage.get(k);
          }
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) storage.set(k, v);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => storage.delete(k));
        }),
      },
    },
    runtime: {
      id: 'mock-extension-id',
      onMessage: {
        addListener: vi.fn((cb: ChromeRuntimeMessageListener) => {
          listeners.push(cb);
        }),
        _listeners: listeners,
      },
    },
  };

  Object.defineProperty(globalThis, 'chrome', {
    value: mock,
    writable: true,
    configurable: true,
  });
  // detectPlatformType 也读 window.chrome
  Object.defineProperty(window, 'chrome', {
    value: mock,
    writable: true,
    configurable: true,
  });

  return mock;
}

async function loadFreshModules() {
  vi.resetModules();
  const init = await import('./init');
  const shared = await import('@shuoshuo-player/shared');
  return { init, shared };
}

describe('F2: initializeApp', () => {
  let chromeMock: ChromeMock;
  const originalChrome = (globalThis as any).chrome;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  afterEach(() => {
    if (originalChrome === undefined) {
      delete (globalThis as any).chrome;
      delete (window as any).chrome;
    } else {
      (globalThis as any).chrome = originalChrome;
      (window as any).chrome = originalChrome;
    }
  });

  it('优先从 ssp_v2_cloud_api_base_url 恢复 baseURL（早于 ssp_v2_player_data）', async () => {
    chromeMock = installChromeMock({
      ssp_v2_cloud_api_base_url: 'https://my.api.example/v1',
    });
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    expect(shared.getCloudApiBaseUrl()).toBe('https://my.api.example/v1');
    // storage.get 共 4 次（每次都是单批 get）：
    // 1) bootstrapPersistence: 读 ssp_v2_cloud_api_base_url
    // 2) bootstrapPersistence: 读 ssp_v2_player_data（与 1 并行调度）
    // 3) detectV1Snapshot: 读 ssp_v2_v1_migration_dismissed（dismiss 检查）
    // 4) detectV1Snapshot: 一次读完 V1_PERSIST_KEYS 的 7 个 key
    expect(chromeMock.storage.local.get).toHaveBeenCalledTimes(4);
  });

  it('ssp_v2_cloud_api_base_url 为空白时 fallback 到默认 baseURL', async () => {
    chromeMock = installChromeMock({ ssp_v2_cloud_api_base_url: '   ' });
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    expect(shared.getCloudApiBaseUrl()).toBe(shared.DEFAULT_CLOUD_API_BASE_URL);
  });

  it('ssp_v2_cloud_api_base_url 不存在时使用默认 baseURL', async () => {
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    expect(shared.getCloudApiBaseUrl()).toBe(shared.DEFAULT_CLOUD_API_BASE_URL);
  });

  it('bili_user_videos.isLoading 始终强制 false（即使快照中是 true）', async () => {
    chromeMock = installChromeMock({
      ssp_v2_player_data: JSON.stringify({
        bili_user_videos: {
          isLoading: true,
          infos: { foo: { bvid: 'BV1', title: 't' } },
          space: {},
          favFolders: {},
        },
      }),
    });
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    const state = shared.useBilibiliUserVideosStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.infos).toEqual({ foo: { bvid: 'BV1', title: 't' } });
  });

  it('从 ssp_v2_player_data 恢复 fav_list / playing_list / ui_profile / lyrics / cloud_service.session', async () => {
    chromeMock = installChromeMock({
      ssp_v2_player_data: JSON.stringify({
        fav_list: {
          list: [{ id: 'a', name: 'A', type: 'CUSTOM', count: 0 }],
        },
        playing_list: { favId: 'a', bvIds: ['BV1', 'BV2'], current: 'BV1' },
        ui_profile: { theme: 'dark', volume: 0.5, autoPlay: true, loopMode: 'loop' },
        lyrics: { lyricMaps: { BV1: { offset: 0, lrc: '', cloudId: undefined } } },
        cloud_service: {
          session: {
            id: 1,
            token: 'tk',
            token_type: 'Bearer',
            expire_at: Date.now() + 99999,
            account: {
              id: 1,
              user_name: 'u',
              nick_name: 'n',
              email: 'e@x.com',
              avatar: '',
              role: 1,
              open_id: '',
              locked: 0,
              created_at: 0,
              updated_at: 0,
            },
          },
        },
      }),
    });
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    expect(shared.useFavListStore.getState().list).toHaveLength(1);
    // hydrate 兼容性：旧 bvIds 字段被正确读到新的 trackIds 字段
    expect(shared.usePlayingListStore.getState().trackIds).toEqual(['BV1', 'BV2']);
    expect(shared.usePlayerProfileStore.getState().theme).toBe('dark');
    expect(shared.usePlayerProfileStore.getState().volume).toBe(0.5);
    expect(shared.useLyricsStore.getState().lyricMaps).toHaveProperty('BV1');
    expect(shared.useCloudServiceStore.getState().session?.token).toBe('tk');
  });

  it('playing_list 的 playNext 信号始终重置为 false', async () => {
    chromeMock = installChromeMock({
      ssp_v2_player_data: JSON.stringify({
        playing_list: { favId: 'a', bvIds: ['BV1'], current: 'BV1' },
      }),
    });
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();
    expect(shared.usePlayingListStore.getState().playNext).toBe(false);
  });

  it('bili_videos 缺失时不污染默认空状态', async () => {
    const { init, shared } = await loadFreshModules();
    await init.initializeApp();

    const state = shared.useBilibiliVideosStore.getState();
    expect(state.ids).toEqual([]);
    expect(state.entities).toEqual({});
  });

  it('启动时调一次 getLoginUserInfo（wbi 密钥 mount-once 与 v1 行为对齐）', async () => {
    const { init, shared } = await loadFreshModules();
    const spy = vi.fn(async () => {});
    shared.useBilibiliUserStore.setState({ getLoginUserInfo: spy });

    await init.initializeApp();
    // triggerWbiRefresh 是 fire-and-forget，等微任务 flush
    await new Promise((r) => setTimeout(r, 0));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('不再注册 chrome.runtime.onMessage 监听器（去掉 wbi 周期刷新机制）', async () => {
    const { init } = await loadFreshModules();
    await init.initializeApp();

    expect(chromeMock.runtime.onMessage.addListener).not.toHaveBeenCalled();
    expect(chromeMock.runtime.onMessage._listeners).toHaveLength(0);
  });

  it('apiBaseUrl 变更时立即写入独立 storage key', async () => {
    const { init, shared } = await loadFreshModules();
    await init.initializeApp();

    chromeMock.storage.local.set.mockClear();

    shared.useCloudServiceStore.getState().setApiBaseUrl('https://changed.api/v2');

    // subscribe 是同步触发，但 setItem 是 async；微任务 flush 后 set 应被调用
    await Promise.resolve();
    await Promise.resolve();

    const calls = chromeMock.storage.local.set.mock.calls as [unknown][];
    const baseUrlCall = calls.find((args) => {
      const obj = args[0] as Record<string, unknown>;
      return obj && Object.prototype.hasOwnProperty.call(obj, 'ssp_v2_cloud_api_base_url');
    });
    expect(baseUrlCall).toBeDefined();
    expect((baseUrlCall![0] as Record<string, unknown>).ssp_v2_cloud_api_base_url).toBe(
      'https://changed.api/v2',
    );
  });

  it('store 状态变更后触发 ssp_v2_player_data 节流写入', async () => {
    vi.useFakeTimers();
    try {
      const { init, shared } = await loadFreshModules();
      await init.initializeApp();

      chromeMock.storage.local.set.mockClear();

      shared.useFavListStore.setState({
        list: [{ id: 'x', name: 'X', type: 'CUSTOM' as never, count: 0 } as never],
      });

      await vi.advanceTimersByTimeAsync(1100);

      const calls = chromeMock.storage.local.set.mock.calls as [unknown][];
      const playerDataCall = calls.find((args) => {
        const obj = args[0] as Record<string, unknown>;
        return obj && Object.prototype.hasOwnProperty.call(obj, 'ssp_v2_player_data');
      });
      expect(playerDataCall).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('损坏的 ssp_v2_player_data JSON 不抛错，应用仍能初始化', async () => {
    chromeMock = installChromeMock({ ssp_v2_player_data: '{ invalid json' });
    const { init } = await loadFreshModules();

    await expect(init.initializeApp()).resolves.toBeUndefined();
  });

  it('chrome.runtime 不存在时跳过 wbi:refresh 监听（普通 Web 平台）', async () => {
    // 不安装 chrome mock，模拟普通浏览器环境
    delete (globalThis as any).chrome;
    delete (window as any).chrome;

    const { init } = await loadFreshModules();
    // 应用仍应正常初始化（走 LocalStorageAdapter）
    await expect(init.initializeApp()).resolves.toBeUndefined();
  });

  it('chrome.runtime.onMessage 缺失时不抛错（兼容旧版扩展上下文）', async () => {
    Object.defineProperty(globalThis, 'chrome', {
      value: {
        storage: {
          local: {
            get: vi.fn(async () => ({})),
            set: vi.fn(async () => {}),
            remove: vi.fn(async () => {}),
          },
        },
        runtime: { id: 'ext' }, // 没有 onMessage
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'chrome', {
      value: (globalThis as any).chrome,
      writable: true,
      configurable: true,
    });

    const { init } = await loadFreshModules();
    await expect(init.initializeApp()).resolves.toBeUndefined();
  });

  /* ─── 失败降级（Phase 5 审查遗留）：模拟存储抛错 / hydrate 失败 ─── */

  it('chrome.storage.local.get 抛错时 initializeApp reject，调用方 catch.finally 仍能继续', async () => {
    // 替换 storage.local.get 为永远抛错的实现（IO 异常 / quota 等场景）
    chromeMock.storage.local.get = vi.fn(async () => {
      throw new Error('storage IO failure');
    });

    const { init } = await loadFreshModules();

    // initializeApp 应当 reject
    await expect(init.initializeApp()).rejects.toThrow(/storage IO failure/);

    // 仿 main.tsx 的降级模式：catch 错误 + finally 继续渲染
    let finallyRan = false;
    let caughtError: unknown = null;
    await init
      .initializeApp()
      .catch((err: unknown) => {
        caughtError = err;
      })
      .finally(() => {
        finallyRan = true;
      });
    expect(finallyRan).toBe(true);
    expect(caughtError).toBeInstanceOf(Error);
  });

  it('单 store hydrate 抛错时 initializeApp reject，调用方仍能渲染 UI', async () => {
    // 注入会触发 hydrate 异常的快照：cloud_service.session 缺关键字段
    // 通过劫持 useCloudServiceStore.updateSession 抛错来模拟 store hydrate 失败
    chromeMock = installChromeMock({
      ssp_v2_player_data: JSON.stringify({
        cloud_service: { session: { token: 'tk' } },
      }),
    });

    const { init, shared } = await loadFreshModules();
    const original = shared.useCloudServiceStore.getState().updateSession;
    shared.useCloudServiceStore.setState({
      updateSession: () => {
        throw new Error('hydrate failure');
      },
    });

    try {
      await expect(init.initializeApp()).rejects.toThrow(/hydrate failure/);

      // 调用方降级模式：catch + finally 模拟 main.tsx 渲染路径
      let renderRan = false;
      await init
        .initializeApp()
        .catch(() => {})
        .finally(() => {
          renderRan = true;
        });
      expect(renderRan).toBe(true);
    } finally {
      shared.useCloudServiceStore.setState({ updateSession: original });
    }
  });
});
