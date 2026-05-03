import { create } from 'zustand';

/**
 * B 站风控对话框状态（v_voucher 触发）
 *
 * 当 fetchMusicUrl 检测到 playurl 接口返回 v_voucher（风控降级响应）时，
 * 调用 openRiskControl 触发全局对话框，引导用户去 bilibili.com 主站完成
 * captcha 校验（B 站主站会自动弹 geetest 拼图）。验证后 cookie
 * x-bili-gaia-vtoken 自动同步到扩展（host_permissions 已包含 .bilibili.com）。
 *
 * 详见 docs/bilibili-API-collect/docs/misc/sign/v_voucher.md
 */
interface RiskControlState {
  /** 对话框打开状态 */
  open: boolean;
  /** 触发风控的 v_voucher（仅展示用，主站验证不需要它） */
  voucher: string | null;
  /** 触发时正在播放的 bvid（重试时清缓存定位用） */
  bvid: string | null;

  openRiskControl: (voucher: string, bvid: string) => void;
  closeRiskControl: () => void;
}

export const useRiskControlStore = create<RiskControlState>((set) => ({
  open: false,
  voucher: null,
  bvid: null,
  openRiskControl: (voucher, bvid) => set({ open: true, voucher, bvid }),
  closeRiskControl: () => set({ open: false, voucher: null, bvid: null }),
}));
