import { useBilibiliUserStore } from '../store/bilibili-user';

/**
 * Wbi 密钥刷新阈值（毫秒）。距上次成功刷新超过此值才会真正调用 nav 接口；
 * 与 v1 单次 mount 行为相比放宽到长会话场景，但避免 30 分钟周期性强制刷新
 * （短期高频 nav 调用可能被 B 站标记异常导致 wbi 接口返回 v_voucher 风控）。
 */
const WBI_REFRESH_THRESHOLD_MS = 20 * 60 * 1000;

/** 上次 nav 调用启动时间戳（毫秒）；进入函数即更新，防止并发重复触发 */
let lastRefreshAt = 0;
/** 当前进行中的 nav Promise，所有并发调用共享 */
let inflightRefresh: Promise<void> | null = null;

/**
 * 按需触发 Wbi 密钥刷新
 *
 * - 首次调用（lastRefreshAt=0）：必触发
 * - 距上次启动 < 20 分钟：跳过（保留旧密钥）
 * - 距上次启动 ≥ 20 分钟：触发新一轮 nav
 * - 并发调用：复用同一个 inflight Promise
 *
 * @param force 强制刷新（如 401 导致密钥失效后兜底重试）
 */
export async function triggerWbiRefresh(force = false): Promise<void> {
  if (inflightRefresh) return inflightRefresh;

  const now = Date.now();
  if (!force && lastRefreshAt > 0 && now - lastRefreshAt < WBI_REFRESH_THRESHOLD_MS) {
    return;
  }
  lastRefreshAt = now;

  inflightRefresh = useBilibiliUserStore
    .getState()
    .getLoginUserInfo()
    .finally(() => {
      inflightRefresh = null;
    });
  return inflightRefresh;
}
