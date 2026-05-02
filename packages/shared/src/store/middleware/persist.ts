import type { StorageAdapter } from '../../types';
import { PERSIST_KEYS, PERSIST_THROTTLE_MS } from '../../constants';

/** 持久化数据的根 key */
export const PERSIST_DATA_KEY = 'player_data';

/**
 * 简易尾沿节流：在窗口期内最后一次调用会在窗口结束时执行
 * 单独实现是为避开 lodash-es 的类型导出问题（TS6 严格模式下 DebouncedFunc 不可移植）
 */
function trailingThrottle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void | Promise<void>,
  wait: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: TArgs | null = null;

  return (...args: TArgs) => {
    pending = args;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const next = pending;
      pending = null;
      if (next) void fn(...next);
    }, wait);
  };
}

export interface PersistMiddleware {
  persistState: (snapshot: Record<string, unknown>) => void;
}

/**
 * 创建跨平台持久化中间件
 * 由各平台（Chrome 扩展 / Tauri / Web）传入对应的 StorageAdapter
 *
 * 使用方式：调用方在 store 订阅时聚合所有 PERSIST_KEYS 对应 store 的快照，
 * 然后调 persistState(snapshot) 节流写入。
 */
export function createPersistMiddleware(adapter: StorageAdapter): PersistMiddleware {
  const persistState = trailingThrottle(async (snapshot: Record<string, unknown>) => {
    const data: Record<string, unknown> = {};
    for (const key of PERSIST_KEYS) {
      if (snapshot[key] !== undefined) {
        data[key] = snapshot[key];
      }
    }
    await adapter.setItem(PERSIST_DATA_KEY, JSON.stringify(data));
  }, PERSIST_THROTTLE_MS);

  return { persistState };
}

/** 从存储恢复状态 */
export async function restoreState(adapter: StorageAdapter): Promise<Record<string, unknown>> {
  try {
    const raw = await adapter.getItem(PERSIST_DATA_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
