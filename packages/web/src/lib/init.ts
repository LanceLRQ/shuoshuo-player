/// <reference types="chrome" />
import {
  bootstrapPersistence,
  setPlatformBridge,
  triggerWbiRefresh,
  WBI_REFRESH_MESSAGE_TYPE,
} from '@shuoshuo-player/shared';
import { createPlatformBridge } from './platform';

function isWbiRefreshMessage(msg: unknown): boolean {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: unknown }).type === WBI_REFRESH_MESSAGE_TYPE
  );
}

/**
 * 应用初始化：在 createRoot.render() 之前调用，store 状态需先于 UI 渲染恢复。
 *
 * Web 端职责：
 * - 注入 Chrome 扩展 / 普通 Web 平台适配器到 shared 单例
 * - 委托 shared.bootstrapPersistence() 完成 baseURL 恢复 + 7 个 store 的 hydrate/subscribe
 * - 监听 chrome.runtime.onMessage('wbi:refresh') 触发 WBI 密钥刷新
 *
 * 重复样板（7 段 setState、7 段 subscribe、collectPersistableSnapshot）已下沉到 shared，
 * 见 packages/shared/src/store/middleware/persist.ts。
 */
export async function initializeApp(): Promise<void> {
  setPlatformBridge(createPlatformBridge());
  await bootstrapPersistence();
  listenChromeWbiRefresh();
  // 启动时立即同步一次 WBI 密钥；alarms 仅负责后续 30 分钟周期刷新。
  // 不等待（nav 接口异步加载，避免阻塞 UI 渲染）。
  void triggerWbiRefresh().catch((err) => {
    if (__DEV_LOG__) console.debug('[WBI-DEBUG] initial triggerWbiRefresh failed', err);
  });
}

function listenChromeWbiRefresh(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener((msg: unknown) => {
    if (isWbiRefreshMessage(msg)) {
      void triggerWbiRefresh();
    }
  });
}
