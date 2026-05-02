import { createPersistMiddleware, restoreState, PERSIST_DATA_KEY } from './persist';
import type { StorageAdapter } from '../../types';

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
