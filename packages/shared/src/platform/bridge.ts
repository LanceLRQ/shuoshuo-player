import type { PlatformBridge } from '../types';

/**
 * PlatformBridge 单例容器
 *
 * 由各平台包（packages/web、packages/desktop）在应用入口处调用 setPlatformBridge()
 * 注入对应实现；业务代码（store / api / hooks）通过 getPlatformBridge() 拿到桥接，
 * 不再直接 import `chrome` 或 `@tauri-apps/api`，保证跨平台共享层零平台耦合。
 *
 * 命中后续测试或服务端渲染场景时可通过 resetPlatformBridge() 清空缓存。
 */
let bridge: PlatformBridge | null = null;

export function setPlatformBridge(next: PlatformBridge): void {
  bridge = next;
}

export function getPlatformBridge(): PlatformBridge {
  if (!bridge) {
    throw new Error(
      '[platform] PlatformBridge 未初始化，请在应用入口调用 setPlatformBridge()',
    );
  }
  return bridge;
}

export function resetPlatformBridge(): void {
  bridge = null;
}
