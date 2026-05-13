import { useFavoritesStore, selectSortedBvids } from './favorites';

function reset() {
  useFavoritesStore.setState({ entries: {} });
}

describe('useFavoritesStore', () => {
  beforeEach(() => {
    reset();
  });

  it('初始 entries 为空对象', () => {
    expect(useFavoritesStore.getState().entries).toEqual({});
  });

  it('toggle：未收藏 → 添加（写入时间戳），返回 true', () => {
    const result = useFavoritesStore.getState().toggle('BV1');
    expect(result).toBe(true);
    const ts = useFavoritesStore.getState().entries.BV1;
    expect(typeof ts).toBe('number');
    expect(ts).toBeGreaterThan(0);
  });

  it('toggle：已收藏 → 移除，返回 false', () => {
    useFavoritesStore.getState().add('BV1');
    const result = useFavoritesStore.getState().toggle('BV1');
    expect(result).toBe(false);
    expect('BV1' in useFavoritesStore.getState().entries).toBe(false);
  });

  it('isFavored 反映存在性', () => {
    expect(useFavoritesStore.getState().isFavored('BV1')).toBe(false);
    useFavoritesStore.getState().add('BV1');
    expect(useFavoritesStore.getState().isFavored('BV1')).toBe(true);
  });

  it('add：已存在 bvid 不覆盖原时间戳（保留"首次喜欢"）', () => {
    useFavoritesStore.setState({ entries: { BV1: 100 } });
    useFavoritesStore.getState().add('BV1');
    expect(useFavoritesStore.getState().entries.BV1).toBe(100);
  });

  it('remove：不存在的 bvid 不抛错', () => {
    expect(() => useFavoritesStore.getState().remove('not-exist')).not.toThrow();
  });

  it('clear：清空所有 entries', () => {
    useFavoritesStore.setState({ entries: { BV1: 100, BV2: 200 } });
    useFavoritesStore.getState().clear();
    expect(useFavoritesStore.getState().entries).toEqual({});
  });
});

describe('selectSortedBvids', () => {
  it('desc：时间戳大的在前', () => {
    expect(selectSortedBvids({ BV1: 100, BV2: 300, BV3: 200 }, 'desc')).toEqual([
      'BV2',
      'BV3',
      'BV1',
    ]);
  });

  it('asc：时间戳小的在前', () => {
    expect(selectSortedBvids({ BV1: 100, BV2: 300, BV3: 200 }, 'asc')).toEqual([
      'BV1',
      'BV3',
      'BV2',
    ]);
  });

  it('同时间戳：按 bvid 字典序保证稳定', () => {
    expect(selectSortedBvids({ BVc: 100, BVa: 100, BVb: 100 }, 'desc')).toEqual([
      'BVa',
      'BVb',
      'BVc',
    ]);
  });

  it('空 entries 返回空数组', () => {
    expect(selectSortedBvids({}, 'desc')).toEqual([]);
  });
});
