/**
 * 更新检查器 Store
 *
 * 职责：
 * - 调用 fetchLatestVersion，节流 6 小时（避免每次启动都打 API）
 * - 持久化最近一次拉到的版本信息（无网络也能显示历史）
 * - 持久化用户主动忽略的版本号（避免反复打扰）
 *
 * 与 UI 解耦：本 store 不直接发通知，由 UpdateNotifier 组件订阅 latestKnown 后决定是否弹 toast。
 */
import { create } from 'zustand';
import { fetchLatestVersion, type UpdateInfo } from '../api/update';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

interface UpdateCheckerState {
  /** 上次检查的 ISO 时间戳；null 表示从未检查 */
  lastCheckedAt: string | null;
  /** 上次成功拉到的版本信息；null 表示从未拉到 */
  latestKnown: UpdateInfo | null;
  /** 用户主动忽略的版本号（精确匹配，比对会跳过） */
  ignoredVersions: string[];
  /** 运行时态：是否正在检查（不持久化） */
  isChecking: boolean;

  /**
   * 检查更新
   *
   * @param options.force true 时跳过节流；false / 缺省时若 6h 内已检查过则直接返回 latestKnown
   * @returns 拉到的版本信息（可能与缓存的 latestKnown 不同）；网络全失败返回 null
   */
  check(options?: { force?: boolean }): Promise<UpdateInfo | null>;

  /** 用户点"忽略此版本" */
  ignoreVersion(version: string): void;

  /** 清空忽略列表（设置页可选暴露） */
  clearIgnored(): void;

  /** 持久化前清理瞬态字段（与其他 store 的 persistSnapshot 钩子模式一致） */
  persistSnapshot(): {
    lastCheckedAt: string | null;
    latestKnown: UpdateInfo | null;
    ignoredVersions: string[];
  };
}

export const useUpdateCheckerStore = create<UpdateCheckerState>((set, get) => ({
  lastCheckedAt: null,
  latestKnown: null,
  ignoredVersions: [],
  isChecking: false,

  async check({ force = false } = {}) {
    const state = get();
    if (state.isChecking) return state.latestKnown;

    // 节流：非 force 模式下，距上次成功检查不足 6h 直接返回缓存
    if (!force && state.lastCheckedAt) {
      const last = Date.parse(state.lastCheckedAt);
      if (!Number.isNaN(last) && Date.now() - last < SIX_HOURS_MS) {
        return state.latestKnown;
      }
    }

    set({ isChecking: true });
    try {
      const info = await fetchLatestVersion();
      // 网络全失败 info 为 null：保留 latestKnown 缓存，但更新 lastCheckedAt 防止
      // force=false 模式下 6h 内反复重试同样会失败的请求
      set({
        isChecking: false,
        lastCheckedAt: new Date().toISOString(),
        latestKnown: info ?? state.latestKnown,
      });
      return info;
    } catch (e) {
      // fetchLatestVersion 内部已 try/catch，理论不会到这里；防御性处理
      if (typeof console !== 'undefined') console.debug('[update-checker] check failed', e);
      set({ isChecking: false });
      return null;
    }
  },

  ignoreVersion(version) {
    set((s) => {
      if (s.ignoredVersions.includes(version)) return s;
      return { ignoredVersions: [...s.ignoredVersions, version] };
    });
  },

  clearIgnored() {
    set({ ignoredVersions: [] });
  },

  persistSnapshot() {
    const s = get();
    return {
      lastCheckedAt: s.lastCheckedAt,
      latestKnown: s.latestKnown,
      ignoredVersions: s.ignoredVersions,
    };
  },
}));
