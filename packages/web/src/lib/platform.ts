/// <reference types="chrome" />
import {
  detectPlatformType,
  type AuthAdapter,
  type PlatformBridge,
  type StorageAdapter,
} from '@shuoshuo-player/shared';
import { ChromeStorageAdapter } from './chrome-storage-adapter';
import { LocalStorageAdapter } from './local-storage-adapter';

// PlatformBridge 单例已下沉到 shared/platform/bridge.ts；
// web 包仅负责构造对应平台的实现并通过 setPlatformBridge() 注入。
export { setPlatformBridge, getPlatformBridge, resetPlatformBridge } from '@shuoshuo-player/shared';

/**
 * Chrome 扩展认证适配器
 *
 * Chrome 插件依赖浏览器自身的 bilibili.com Cookie 自动鉴权，
 * 因此 login() 仅打开登录页让用户在浏览器主域内完成；
 * 登录成功事件依赖 cookie 实时生效，不需要单独监听。
 */
class ChromeAuthAdapter implements AuthAdapter {
  async login(): Promise<void> {
    window.open('https://passport.bilibili.com/login', '_blank');
  }

  async logout(): Promise<void> {
    // 浏览器 Cookie 由用户在浏览器设置中清理；扩展层不主动操作 Cookie
  }

  onLoginSuccess(_callback: () => void): void {
    // Chrome 扩展无独立登录流程，cookie 即时生效，无需回调
  }
}

/**
 * 创建跨平台桥接（按当前运行平台返回对应实现）
 *
 * - chrome-extension：ChromeStorageAdapter + ChromeAuthAdapter
 * - tauri：在 packages/desktop 内单独构造，此处不应被命中
 * - web：LocalStorageAdapter + ChromeAuthAdapter（开发态复用）
 */
export function createPlatformBridge(): PlatformBridge {
  const type = detectPlatformType();

  let storage: StorageAdapter;
  let auth: AuthAdapter;

  switch (type) {
    case 'chrome-extension':
      storage = new ChromeStorageAdapter();
      auth = new ChromeAuthAdapter();
      break;
    case 'tauri':
      throw new Error(
        '[platform] Tauri 桥接需在 packages/desktop 内创建，packages/web 不应执行此分支',
      );
    case 'web':
    default:
      storage = new LocalStorageAdapter();
      auth = new ChromeAuthAdapter();
      break;
  }

  return { type, storage, auth };
}
