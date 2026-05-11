import type { PlatformType } from '../types';

/**
 * 运行时检测当前平台类型
 *
 * 检测顺序：
 * 1. Tauri：window.__TAURI_INTERNALS__（Tauri v2 内部对象）
 * 2. Chrome 扩展：chrome.runtime.id 存在（content script 与 popup 都有）
 * 3. 兜底：'web'（普通浏览器或开发态）
 *
 * 完整 PlatformBridge（含 storage/auth/spider 实现）由各平台包注入；
 * 此函数仅用于 UI 层做平台条件渲染（如服务设置页 baseURL 输入框是否置灰）。
 */
export function detectPlatformType(): PlatformType {
  if (typeof window === 'undefined') return 'web';

  const win = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    chrome?: { runtime?: { id?: string } };
  };

  if (win.__TAURI_INTERNALS__) return 'tauri';
  if (win.chrome?.runtime?.id) return 'chrome-extension';
  return 'web';
}
