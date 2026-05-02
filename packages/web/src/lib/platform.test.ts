/// <reference types="chrome" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * createPlatformBridge / getPlatformBridge 测试
 *
 * detectPlatformType 在 jsdom 环境下根据 window.chrome.runtime.id /
 * window.__TAURI_INTERNALS__ 判断平台。本测试文件用 vi.resetModules 让每个用例
 * 独立加载 platform.ts（避免单例缓存污染）。
 */

const originalChrome = (window as any).chrome;

afterEach(() => {
  if (originalChrome === undefined) {
    delete (window as any).chrome;
  } else {
    (window as any).chrome = originalChrome;
  }
  delete (window as any).__TAURI_INTERNALS__;
});

async function loadFreshPlatform() {
  vi.resetModules();
  return import('./platform');
}

describe('createPlatformBridge / getPlatformBridge', () => {
  it('chrome.runtime.id 存在 → chrome-extension 平台', async () => {
    (window as any).chrome = { runtime: { id: 'ext-id' }, storage: { local: {} } };
    const m = await loadFreshPlatform();
    const bridge = m.createPlatformBridge();
    expect(bridge.type).toBe('chrome-extension');
    expect(bridge.storage.constructor.name).toBe('ChromeStorageAdapter');
  });

  it('Tauri 平台 → 抛错（要求由 desktop 包构造）', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    const m = await loadFreshPlatform();
    expect(() => m.createPlatformBridge()).toThrow(/Tauri/);
  });

  it('普通 web 浏览器 → web 平台 + LocalStorageAdapter', async () => {
    delete (window as any).chrome;
    delete (window as any).__TAURI_INTERNALS__;
    const m = await loadFreshPlatform();
    const bridge = m.createPlatformBridge();
    expect(bridge.type).toBe('web');
    expect(bridge.storage.constructor.name).toBe('LocalStorageAdapter');
  });

  it('getPlatformBridge 缓存单例', async () => {
    delete (window as any).chrome;
    const m = await loadFreshPlatform();
    const a = m.getPlatformBridge();
    const b = m.getPlatformBridge();
    expect(a).toBe(b);
  });
});

describe('ChromeAuthAdapter（间接覆盖）', () => {
  it('login 使用 window.open', async () => {
    (window as any).chrome = { runtime: { id: 'ext-id' }, storage: { local: {} } };
    const m = await loadFreshPlatform();
    const bridge = m.createPlatformBridge();
    const spy = vi.spyOn(window, 'open').mockReturnValue(null);
    await bridge.auth.login();
    expect(spy).toHaveBeenCalledWith('https://passport.bilibili.com/login', '_blank');
    spy.mockRestore();
  });

  it('logout 与 onLoginSuccess 不抛错（无副作用，浏览器自身处理 cookie）', async () => {
    (window as any).chrome = { runtime: { id: 'ext-id' }, storage: { local: {} } };
    const m = await loadFreshPlatform();
    const bridge = m.createPlatformBridge();
    await expect(bridge.auth.logout()).resolves.toBeUndefined();
    expect(() => bridge.auth.onLoginSuccess(() => {})).not.toThrow();
  });
});
