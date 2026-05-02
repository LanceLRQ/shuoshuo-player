/// <reference types="chrome" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * F2: web/lib/init.test.ts
 *
 * 验证 initializeApp() 的关键行为：
 * - baseURL 优先恢复（早于云服务调用）
 * - bili_user_videos.isLoading 强制为 false
 * - 各 store 状态从 player_data 中恢复
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

  it('优先从 cloud_api_base_url 恢复 baseURL（早于 player_data）', async () => {
    chromeMock = installChromeMock({
      cloud_api_base_url: 'https://my.api.example/v1',
    });
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    expect(shared.getCloudApiBaseUrl()).toBe('https://my.api.example/v1');
    // storage.get 被并行调用了两次（cloud_api_base_url + player_data）
    expect(chromeMock.storage.local.get).toHaveBeenCalledTimes(2);
  });

  it('cloud_api_base_url 为空白时 fallback 到默认 baseURL', async () => {
    chromeMock = installChromeMock({ cloud_api_base_url: '   ' });
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    expect(shared.getCloudApiBaseUrl()).toBe(shared.DEFAULT_CLOUD_API_BASE_URL);
  });

  it('cloud_api_base_url 不存在时使用默认 baseURL', async () => {
    const { init, shared } = await loadFreshModules();

    await init.initializeApp();

    expect(shared.getCloudApiBaseUrl()).toBe(shared.DEFAULT_CLOUD_API_BASE_URL);
  });

  it('bili_user_videos.isLoading 始终强制 false（即使快照中是 true）', async () => {
    chromeMock = installChromeMock({
      player_data: JSON.stringify({
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

  it('从 player_data 恢复 fav_list / playing_list / ui_profile / lyrics / cloud_service.session', async () => {
    chromeMock = installChromeMock({
      player_data: JSON.stringify({
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
    expect(shared.usePlayingListStore.getState().bvIds).toEqual(['BV1', 'BV2']);
    expect(shared.usePlayerProfileStore.getState().theme).toBe('dark');
    expect(shared.usePlayerProfileStore.getState().volume).toBe(0.5);
    expect(shared.useLyricsStore.getState().lyricMaps).toHaveProperty('BV1');
    expect(shared.useCloudServiceStore.getState().session?.token).toBe('tk');
  });

  it('playing_list 的 playNext 信号始终重置为 false', async () => {
    chromeMock = installChromeMock({
      player_data: JSON.stringify({
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

  it('注册 chrome.runtime.onMessage 监听器', async () => {
    const { init } = await loadFreshModules();
    await init.initializeApp();

    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(chromeMock.runtime.onMessage._listeners).toHaveLength(1);
  });

  it('收到 wbi:refresh 消息后触发 getLoginUserInfo', async () => {
    const { init, shared } = await loadFreshModules();
    const spy = vi.fn(async () => {});
    shared.useBilibiliUserStore.setState({ getLoginUserInfo: spy });

    await init.initializeApp();

    const listener = chromeMock.runtime.onMessage._listeners[0];
    listener({ type: shared.WBI_REFRESH_MESSAGE_TYPE }, {}, () => {});

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('收到非 wbi:refresh 消息时不触发 getLoginUserInfo', async () => {
    const { init, shared } = await loadFreshModules();
    const spy = vi.fn(async () => {});
    shared.useBilibiliUserStore.setState({ getLoginUserInfo: spy });

    await init.initializeApp();

    const listener = chromeMock.runtime.onMessage._listeners[0];
    listener({ type: 'other' }, {}, () => {});
    listener('not-an-object', {}, () => {});
    listener(null, {}, () => {});

    expect(spy).not.toHaveBeenCalled();
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
      return obj && Object.prototype.hasOwnProperty.call(obj, 'cloud_api_base_url');
    });
    expect(baseUrlCall).toBeDefined();
    expect((baseUrlCall![0] as Record<string, unknown>).cloud_api_base_url).toBe(
      'https://changed.api/v2',
    );
  });

  it('store 状态变更后触发 player_data 节流写入', async () => {
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
        return obj && Object.prototype.hasOwnProperty.call(obj, 'player_data');
      });
      expect(playerDataCall).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('损坏的 player_data JSON 不抛错，应用仍能初始化', async () => {
    chromeMock = installChromeMock({ player_data: '{ invalid json' });
    const { init } = await loadFreshModules();

    await expect(init.initializeApp()).resolves.toBeUndefined();
  });
});
