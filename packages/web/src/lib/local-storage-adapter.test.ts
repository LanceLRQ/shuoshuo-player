import { LocalStorageAdapter } from './local-storage-adapter';

describe('LocalStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getItem 返回 localStorage 值', async () => {
    localStorage.setItem('k', 'v');
    const adapter = new LocalStorageAdapter();
    expect(await adapter.getItem('k')).toBe('v');
  });

  it('getItem key 不存在返回 null', async () => {
    const adapter = new LocalStorageAdapter();
    expect(await adapter.getItem('missing')).toBeNull();
  });

  it('setItem 写入 localStorage', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
  });

  it('removeItem 删除指定 key', async () => {
    localStorage.setItem('k', 'v');
    const adapter = new LocalStorageAdapter();
    await adapter.removeItem('k');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('空字符串保持为字符串', async () => {
    localStorage.setItem('empty', '');
    const adapter = new LocalStorageAdapter();
    expect(await adapter.getItem('empty')).toBe('');
  });
});
