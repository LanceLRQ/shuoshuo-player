/// <reference types="chrome" />
import { ChromeStorageAdapter } from './chrome-storage-adapter';

interface ChromeMock {
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };
}

function createChromeMock(initial: Record<string, unknown> = {}): ChromeMock {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    storage: {
      local: {
        get: vi.fn(async (keys?: string | string[]) => {
          if (!keys) return Object.fromEntries(store);
          const arr = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const k of arr) {
            if (store.has(k)) out[k] = store.get(k);
          }
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => store.delete(k));
        }),
      },
    },
  };
}

describe('F1: ChromeStorageAdapter', () => {
  let chromeMock: ChromeMock;
  const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

  beforeEach(() => {
    chromeMock = createChromeMock();
    Object.defineProperty(globalThis, 'chrome', {
      value: chromeMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'chrome', {
      value: originalChrome,
      writable: true,
      configurable: true,
    });
  });

  describe('getItem', () => {
    it('返回字符串值', async () => {
      chromeMock = createChromeMock({ k: 'value' });
      Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true });
      const adapter = new ChromeStorageAdapter();
      expect(await adapter.getItem('k')).toBe('value');
      expect(chromeMock.storage.local.get).toHaveBeenCalledWith(['k']);
    });

    it('key 不存在返回 null', async () => {
      const adapter = new ChromeStorageAdapter();
      expect(await adapter.getItem('missing')).toBeNull();
    });

    it('非字符串值（对象/数字/布尔）一律视为 null（守卫）', async () => {
      chromeMock = createChromeMock({
        obj: { a: 1 },
        num: 42,
        bool: true,
      });
      Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true });
      const adapter = new ChromeStorageAdapter();
      expect(await adapter.getItem('obj')).toBeNull();
      expect(await adapter.getItem('num')).toBeNull();
      expect(await adapter.getItem('bool')).toBeNull();
    });

    it('空字符串视为有效字符串值（不被 fallback 为 null）', async () => {
      chromeMock = createChromeMock({ empty: '' });
      Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true });
      const adapter = new ChromeStorageAdapter();
      expect(await adapter.getItem('empty')).toBe('');
    });
  });

  describe('setItem', () => {
    it('正确写入 key/value 到 chrome.storage.local', async () => {
      const adapter = new ChromeStorageAdapter();
      await adapter.setItem('foo', 'bar');
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ foo: 'bar' });
      expect(await adapter.getItem('foo')).toBe('bar');
    });

    it('覆盖既有 key', async () => {
      const adapter = new ChromeStorageAdapter();
      await adapter.setItem('foo', '1');
      await adapter.setItem('foo', '2');
      expect(await adapter.getItem('foo')).toBe('2');
    });
  });

  describe('removeItem', () => {
    it('删除指定 key', async () => {
      const adapter = new ChromeStorageAdapter();
      await adapter.setItem('foo', 'bar');
      await adapter.removeItem('foo');
      expect(chromeMock.storage.local.remove).toHaveBeenCalledWith('foo');
      expect(await adapter.getItem('foo')).toBeNull();
    });

    it('删除不存在的 key 不抛错', async () => {
      const adapter = new ChromeStorageAdapter();
      await expect(adapter.removeItem('missing')).resolves.toBeUndefined();
    });
  });
});
