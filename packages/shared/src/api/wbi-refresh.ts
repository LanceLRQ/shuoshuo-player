import { useBilibiliUserStore } from '../store/bilibili-user';

/**
 * 触发 WBI 密钥刷新
 *
 * WBI 密钥从 nav 接口的 wbi_img 字段提取，长时间运行（>30 分钟）需要刷新，
 * 否则后续 WBI 签名将因密钥过期而失败。
 *
 * 平台层各自决定何时调用：
 * - Chrome 扩展：background SW 接收 chrome.alarms("wbi-refresh") 触发后转发到 player 页 → 此函数
 * - Tauri 桌面端：前端 setInterval 每 N 分钟自调用一次此函数
 *
 * 函数内部统一通过 store action 重新 fetch，调用方无需感知具体 store 形状。
 */
export async function triggerWbiRefresh(): Promise<void> {
  await useBilibiliUserStore.getState().getLoginUserInfo();
}
