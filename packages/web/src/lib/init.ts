/// <reference types="chrome" />
import {
  bootstrapPersistence,
  setPlatformBridge,
  triggerWbiRefresh,
  useUpdateCheckerStore,
} from '@shuoshuo-player/shared';
import { createPlatformBridge } from './platform';
import { detectV1Snapshot } from './v1-migration';
import { useV1MigrationStore } from '@/stores/v1-migration-store';

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

  // 仅 Chrome 扩展场景：检测 chrome.storage.local 中是否残留 v1 旧数据。
  // 命中则把数据塞入 useV1MigrationStore，由 App.tsx 顶层的 <MigrationGate /> 弹出引导弹层。
  // 失败 try/catch 兜底，绝不阻塞主初始化流程；
  // 用 console.warn 而非 console.debug 让 prod 环境也保留可见线索（便于用户截图反馈）。
  try {
    const snapshot = await detectV1Snapshot();
    if (snapshot) {
      useV1MigrationStore.getState().setPending(snapshot.raw, snapshot.parsed);
    }
  } catch (err) {
    console.warn('[v1-migration] detect failed', err);
  }

  await bootstrapPersistence();
  // 启动时拉一次 wbi 密钥；不等待（nav 接口异步加载，避免阻塞 UI 渲染）
  void triggerWbiRefresh().catch((err) => {
    if (__DEV_LOG__) console.debug('[WBI-DEBUG] initial triggerWbiRefresh failed', err);
  });

  // 启动 5 秒后跑一次更新检查（节流 6h），避免与 wbi 初始化抢资源
  // store 内部已节流；这里 setTimeout 仅延后初次触发时机
  setTimeout(() => {
    void useUpdateCheckerStore.getState().check();
  }, 5000);
}
