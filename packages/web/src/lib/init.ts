/// <reference types="chrome" />
import {
  bootstrapPersistence,
  setPlatformBridge,
  triggerWbiRefresh,
} from '@shuoshuo-player/shared';
import { createPlatformBridge } from './platform';

/**
 * 应用初始化：在 createRoot.render() 之前调用，store 状态需先于 UI 渲染恢复。
 *
 * Web 端职责：
 * - 注入 Chrome 扩展 / 普通 Web 平台适配器到 shared 单例
 * - 委托 shared.bootstrapPersistence() 完成 baseURL 恢复 + 7 个 store 的 hydrate/subscribe
 * - 启动时调一次 nav 接口拉取 wbi 密钥（与 v1 player.js mount-once 行为一致）
 *
 * Wbi 刷新策略：B 站 wbi key 每日更新一次，单次会话内无需周期刷新；
 * 多次调 nav 反而可能被风控标记为机器人，导致 wbi 接口返回 v_voucher 降级响应。
 * 因此移除原有的 chrome.alarms 30 分钟周期刷新与 onMessage 监听。
 */
export async function initializeApp(): Promise<void> {
  setPlatformBridge(createPlatformBridge());
  await bootstrapPersistence();
  // 启动时拉一次 wbi 密钥；不等待（nav 接口异步加载，避免阻塞 UI 渲染）
  void triggerWbiRefresh().catch((err) => {
    if (__DEV_LOG__) console.debug('[WBI-DEBUG] initial triggerWbiRefresh failed', err);
  });
}
