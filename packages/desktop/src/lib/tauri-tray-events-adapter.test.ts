const mockListen = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

import { TauriTrayEventsAdapter } from './tauri-tray-events-adapter';

describe('TauriTrayEventsAdapter', () => {
  beforeEach(() => {
    mockListen.mockReset();
  });

  it('onOpenSettings 调用 listen 注册 tray:open-settings 事件', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValueOnce(unlisten);
    const adapter = new TauriTrayEventsAdapter();
    const callback = vi.fn();

    const unsub = adapter.onOpenSettings(callback);

    expect(mockListen).toHaveBeenCalledTimes(1);
    expect(mockListen.mock.calls[0][0]).toBe('tray:open-settings');
    // 触发 listener handler 应调到外部 callback
    const handler = mockListen.mock.calls[0][1] as () => void;
    handler();
    expect(callback).toHaveBeenCalledTimes(1);

    // unsubscribe 应在 register Promise 解析后调用 unlisten
    unsub();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe 在 listen 注册完成前调用：race 安全（等 promise 后 unlisten）', async () => {
    let resolveListen!: (un: () => void) => void;
    mockListen.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveListen = resolve;
      }),
    );
    const adapter = new TauriTrayEventsAdapter();
    const unsub = adapter.onOpenSettings(() => {});

    // 立即取消订阅
    unsub();
    // 之后 listen 才解析
    const unlisten = vi.fn();
    resolveListen(unlisten);
    await Promise.resolve();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('多次 unsubscribe 幂等', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValueOnce(unlisten);
    const adapter = new TauriTrayEventsAdapter();
    const unsub = adapter.onOpenSettings(() => {});

    unsub();
    unsub();
    unsub();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
