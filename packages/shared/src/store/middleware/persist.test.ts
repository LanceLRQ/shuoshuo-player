import {
  createPersistMiddleware,
  restoreState,
  PERSIST_DATA_KEY,
  STORE_PERSIST_REGISTRY,
  collectPersistableSnapshot,
  bootstrapPersistence,
} from './persist';
import type { StorageAdapter } from '../../types';
import { CLOUD_API_BASE_URL_STORAGE_KEY, DEFAULT_CLOUD_API_BASE_URL } from '../../constants';
import { setPlatformBridge, resetPlatformBridge } from '../../platform';
import { getCloudApiBaseUrl } from '../../api/client';
import { useBilibiliUserVideosStore } from '../bilibili-user-videos';
import { useBilibiliVideosStore } from '../bilibili-videos';
import { useFavListStore } from '../fav-list';
import { useLyricsStore } from '../lyrics';
import { usePlayerProfileStore } from '../player-profile';
import { usePlayingListStore } from '../playing-list';
import { useCloudServiceStore } from '../cloud-service';

function makeAdapter(): StorageAdapter & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

describe('A5/C3: createPersistMiddleware 节流写入', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1000ms 内多次调用合并为 1 次写入（最后一次的 snapshot 生效）', async () => {
    const adapter = makeAdapter();
    const { persistState } = createPersistMiddleware(adapter);

    persistState({ ui_profile: { theme: 'light' } });
    persistState({ ui_profile: { theme: 'dark' } });
    persistState({ ui_profile: { theme: 'auto' } });

    expect(adapter.setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(adapter.setItem).toHaveBeenCalledTimes(1);
    const [key, raw] = (adapter.setItem as unknown as { mock: { calls: [string, string][] } })
      .mock.calls[0];
    expect(key).toBe(PERSIST_DATA_KEY);
    expect(JSON.parse(raw)).toEqual({ ui_profile: { theme: 'auto' } });
  });

  it('两次窗口期独立计数：超时后立即可触发下一轮', async () => {
    const adapter = makeAdapter();
    const { persistState } = createPersistMiddleware(adapter);

    persistState({ ui_profile: { theme: 'light' } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(adapter.setItem).toHaveBeenCalledTimes(1);

    persistState({ ui_profile: { theme: 'dark' } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(adapter.setItem).toHaveBeenCalledTimes(2);
  });

  it('仅 PERSIST_KEYS 白名单内字段被写入（其他 key 被丢弃）', async () => {
    const adapter = makeAdapter();
    const { persistState } = createPersistMiddleware(adapter);

    persistState({
      ui_profile: { theme: 'dark' },
      __unauthorized__: { secret: 'x' },
      cloud_service: { token: 't' },
    });
    await vi.advanceTimersByTimeAsync(1000);

    const raw = adapter._store.get(PERSIST_DATA_KEY)!;
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('ui_profile');
    expect(parsed).toHaveProperty('cloud_service');
    expect(parsed).not.toHaveProperty('__unauthorized__');
  });
});

describe('A5: restoreState', () => {
  it('正常 JSON 反序列化', async () => {
    const adapter = makeAdapter();
    await adapter.setItem(PERSIST_DATA_KEY, JSON.stringify({ ui_profile: { theme: 'dark' } }));

    const out = await restoreState(adapter);
    expect(out).toEqual({ ui_profile: { theme: 'dark' } });
  });

  it('空值返回空对象', async () => {
    const adapter = makeAdapter();
    expect(await restoreState(adapter)).toEqual({});
  });

  it('损坏 JSON 不抛错而是返回空对象', async () => {
    const adapter = makeAdapter();
    await adapter.setItem(PERSIST_DATA_KEY, '{ this is not json');
    expect(await restoreState(adapter)).toEqual({});
  });
});

describe('STORE_PERSIST_REGISTRY hydrate/snapshot', () => {
  beforeEach(() => {
    // 清理 store 到初始态
    useBilibiliVideosStore.setState({ ids: [], entities: {} });
    useBilibiliUserVideosStore.setState({
      isLoading: false,
      infos: {},
      space: {},
      favFolders: {},
    });
    usePlayingListStore.setState({ favId: '', bvIds: [], current: '', playNext: false });
    useFavListStore.setState({ list: [] });
    usePlayerProfileStore.setState({
      theme: 'auto',
      volume: 0.8,
      autoPlay: false,
      loopMode: 'loop',
    });
    useLyricsStore.setState({ lyricMaps: {} });
    useCloudServiceStore.getState().clearSession();
  });

  function getEntry(key: string) {
    const entry = STORE_PERSIST_REGISTRY.find((e) => e.key === key);
    if (!entry) throw new Error(`registry entry ${key} 不存在`);
    return entry;
  }

  it('注册表覆盖 7 个 PERSIST_KEYS', () => {
    const keys = STORE_PERSIST_REGISTRY.map((e) => e.key).sort();
    expect(keys).toEqual(
      [
        'bili_videos',
        'bili_user_videos',
        'playing_list',
        'fav_list',
        'ui_profile',
        'lyrics',
        'cloud_service',
      ].sort(),
    );
  });

  it('bili_videos hydrate / snapshot 往返一致', () => {
    const data = { ids: ['BV1'], entities: { BV1: { bvid: 'BV1' } } };
    getEntry('bili_videos').hydrate(data);
    expect(useBilibiliVideosStore.getState().ids).toEqual(['BV1']);
    const snap = getEntry('bili_videos').snapshot() as typeof data;
    expect(snap.ids).toEqual(['BV1']);
  });

  it('bili_user_videos hydrate 强制 isLoading=false（即使快照中是 true）', () => {
    getEntry('bili_user_videos').hydrate({
      isLoading: true,
      infos: { '1': { update_time: 0, video_list: [], count: 0, update_type: '' } },
    });
    expect(useBilibiliUserVideosStore.getState().isLoading).toBe(false);
    expect(useBilibiliUserVideosStore.getState().infos['1']).toBeDefined();
  });

  it('playing_list hydrate playNext 始终重置为 false', () => {
    getEntry('playing_list').hydrate({ favId: 'a', bvIds: ['BV1'], current: 'BV1' });
    expect(usePlayingListStore.getState().playNext).toBe(false);
    expect(usePlayingListStore.getState().bvIds).toEqual(['BV1']);
  });

  it('fav_list hydrate 缺失字段兜底空数组', () => {
    getEntry('fav_list').hydrate({});
    expect(useFavListStore.getState().list).toEqual([]);
  });

  it('ui_profile hydrate 直接合并部分字段', () => {
    getEntry('ui_profile').hydrate({ theme: 'dark', volume: 0.3 });
    expect(usePlayerProfileStore.getState().theme).toBe('dark');
    expect(usePlayerProfileStore.getState().volume).toBe(0.3);
  });

  it('lyrics hydrate', () => {
    const lyricMaps = { BV1: { bvid: 'BV1', offset: 0, lrc: '' } };
    getEntry('lyrics').hydrate({ lyricMaps });
    expect(useLyricsStore.getState().lyricMaps.BV1).toBeDefined();
  });

  it('cloud_service hydrate session（缺失 session 时不抛错）', () => {
    getEntry('cloud_service').hydrate({});
    expect(useCloudServiceStore.getState().session.token).toBe('');

    getEntry('cloud_service').hydrate({
      session: {
        id: 1,
        token: 'tk',
        token_type: 'Bearer',
        expire_at: Date.now() / 1000 + 9999,
        account: { id: 1, user_name: 'u', nick_name: 'n', avatar: '', role: 1 },
      },
    });
    expect(useCloudServiceStore.getState().session.token).toBe('tk');
  });

  it('hydrate 收到非对象时静默忽略', () => {
    expect(() => getEntry('bili_videos').hydrate(null)).not.toThrow();
    expect(() => getEntry('bili_videos').hydrate('string')).not.toThrow();
    expect(useBilibiliVideosStore.getState().ids).toEqual([]);
  });

  it('subscribe 返回 unsubscribe 函数', () => {
    const cb = vi.fn();
    const unsub = getEntry('fav_list').subscribe(cb);
    useFavListStore.setState({ list: [] });
    expect(cb).toHaveBeenCalled();
    unsub();
    cb.mockClear();
    useFavListStore.setState({ list: [] });
    expect(cb).not.toHaveBeenCalled();
  });

  it('collectPersistableSnapshot 聚合所有 7 个 store 当前状态', () => {
    useFavListStore.setState({
      list: [{ id: 'a', name: 'A', type: 'CUSTOM' as never, bv_ids: [] } as never],
    });
    const snap = collectPersistableSnapshot();
    expect(Object.keys(snap).sort()).toEqual(STORE_PERSIST_REGISTRY.map((e) => e.key).sort());
    expect((snap.fav_list as { list: unknown[] }).list).toHaveLength(1);
  });
});

describe('bootstrapPersistence', () => {
  beforeEach(() => {
    resetPlatformBridge();
    useFavListStore.setState({ list: [] });
    useCloudServiceStore.getState().clearSession();
    useCloudServiceStore.setState({ apiBaseUrl: '' });
  });

  afterEach(() => {
    resetPlatformBridge();
  });

  it('恢复 cloud_api_base_url 到 client，并行读取 baseURL + player_data', async () => {
    const adapter = makeAdapter();
    await adapter.setItem(CLOUD_API_BASE_URL_STORAGE_KEY, 'https://my.api/v3');
    setPlatformBridge({ type: 'web', storage: adapter, auth: makeAuthAdapter() });

    await bootstrapPersistence();

    expect(getCloudApiBaseUrl()).toBe('https://my.api/v3');
    expect(adapter.getItem).toHaveBeenCalledWith(CLOUD_API_BASE_URL_STORAGE_KEY);
    expect(adapter.getItem).toHaveBeenCalledWith(PERSIST_DATA_KEY);
  });

  it('cloud_api_base_url 为空白时 fallback 到默认值', async () => {
    const adapter = makeAdapter();
    await adapter.setItem(CLOUD_API_BASE_URL_STORAGE_KEY, '   ');
    setPlatformBridge({ type: 'web', storage: adapter, auth: makeAuthAdapter() });

    await bootstrapPersistence();
    expect(getCloudApiBaseUrl()).toBe(DEFAULT_CLOUD_API_BASE_URL);
  });

  it('player_data 中各 store 字段 hydrate 完成', async () => {
    const adapter = makeAdapter();
    await adapter.setItem(
      PERSIST_DATA_KEY,
      JSON.stringify({
        fav_list: { list: [{ id: 'a', name: 'A', type: 'CUSTOM', bv_ids: [] }] },
        ui_profile: { theme: 'dark', volume: 0.4, autoPlay: true, loopMode: 'random' },
      }),
    );
    setPlatformBridge({ type: 'web', storage: adapter, auth: makeAuthAdapter() });

    await bootstrapPersistence();

    expect(useFavListStore.getState().list).toHaveLength(1);
    expect(usePlayerProfileStore.getState().theme).toBe('dark');
    expect(usePlayerProfileStore.getState().loopMode).toBe('random');
  });

  it('apiBaseUrl 变更后立即写入独立 storage key（与 player_data 节流通道解耦）', async () => {
    const adapter = makeAdapter();
    setPlatformBridge({ type: 'web', storage: adapter, auth: makeAuthAdapter() });
    await bootstrapPersistence();

    (adapter.setItem as unknown as { mockClear: () => void }).mockClear();
    useCloudServiceStore.getState().setApiBaseUrl('https://changed/v9');

    // subscribe 同步触发；微任务 flush 后 setItem 应被调用
    await Promise.resolve();
    await Promise.resolve();

    const calls = (adapter.setItem as unknown as { mock: { calls: [string, string][] } }).mock
      .calls;
    const baseUrlCall = calls.find(([k]) => k === CLOUD_API_BASE_URL_STORAGE_KEY);
    expect(baseUrlCall).toBeDefined();
    expect(baseUrlCall![1]).toBe('https://changed/v9');
  });

  it('未先 setPlatformBridge 时抛错', async () => {
    await expect(bootstrapPersistence()).rejects.toThrow(/未初始化/);
  });
});

function makeAuthAdapter() {
  return {
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    onLoginSuccess: vi.fn(),
  };
}
