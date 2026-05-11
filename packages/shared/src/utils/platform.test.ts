import { detectPlatformType } from './platform';

describe('detectPlatformType', () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it('无 window 时（node env）返回 web', () => {
    delete (globalThis as { window?: unknown }).window;
    expect(detectPlatformType()).toBe('web');
  });

  it('window.__TAURI_INTERNALS__ 存在时返回 tauri', () => {
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {},
    };
    expect(detectPlatformType()).toBe('tauri');
  });

  it('window.chrome.runtime.id 存在时返回 chrome-extension', () => {
    (globalThis as { window?: unknown }).window = {
      chrome: { runtime: { id: 'ext-id' } },
    };
    expect(detectPlatformType()).toBe('chrome-extension');
  });

  it('普通浏览器 window 返回 web', () => {
    (globalThis as { window?: unknown }).window = {};
    expect(detectPlatformType()).toBe('web');
  });

  it('Tauri 标记优先于 chrome 检测', () => {
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {},
      chrome: { runtime: { id: 'ext-id' } },
    };
    expect(detectPlatformType()).toBe('tauri');
  });
});
