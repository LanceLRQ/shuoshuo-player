import {
  setPlatformBridge,
  getPlatformBridge,
  resetPlatformBridge,
} from './bridge';
import type { PlatformBridge, StorageAdapter, AuthAdapter } from '../types';

function makeBridge(): PlatformBridge {
  const storage: StorageAdapter = {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  };
  const auth: AuthAdapter = {
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    onLoginSuccess: vi.fn(),
  };
  return { type: 'web', storage, auth };
}

describe('PlatformBridge 单例', () => {
  beforeEach(() => {
    resetPlatformBridge();
  });

  it('未初始化时 getPlatformBridge() 抛错（明确提示）', () => {
    expect(() => getPlatformBridge()).toThrow(/未初始化/);
  });

  it('setPlatformBridge → getPlatformBridge 返回同一引用', () => {
    const bridge = makeBridge();
    setPlatformBridge(bridge);
    expect(getPlatformBridge()).toBe(bridge);
  });

  it('再次 setPlatformBridge 覆盖前一个实例', () => {
    const a = makeBridge();
    const b = makeBridge();
    setPlatformBridge(a);
    setPlatformBridge(b);
    expect(getPlatformBridge()).toBe(b);
    expect(getPlatformBridge()).not.toBe(a);
  });

  it('resetPlatformBridge 清空后再次抛错', () => {
    setPlatformBridge(makeBridge());
    resetPlatformBridge();
    expect(() => getPlatformBridge()).toThrow(/未初始化/);
  });
});
