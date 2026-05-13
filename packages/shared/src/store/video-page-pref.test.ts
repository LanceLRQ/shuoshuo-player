import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoPagePrefStore } from './video-page-pref';

describe('useVideoPagePrefStore', () => {
  beforeEach(() => {
    useVideoPagePrefStore.setState({ defaultPage: {} });
  });

  it('setDefaultPage 写入 page >= 2', () => {
    useVideoPagePrefStore.getState().setDefaultPage('BV1aB4y1k7Yx', 3);
    expect(useVideoPagePrefStore.getState().defaultPage['BV1aB4y1k7Yx']).toBe(3);
  });

  it('setDefaultPage(bvid, 1) 自动删除 key', () => {
    useVideoPagePrefStore.setState({ defaultPage: { BV1aB4y1k7Yx: 3 } });
    useVideoPagePrefStore.getState().setDefaultPage('BV1aB4y1k7Yx', 1);
    expect('BV1aB4y1k7Yx' in useVideoPagePrefStore.getState().defaultPage).toBe(false);
  });

  it('setDefaultPage(bvid, 0) / 负数 / 非整数 → 视为清空', () => {
    useVideoPagePrefStore.setState({ defaultPage: { BV1aB4y1k7Yx: 3 } });
    useVideoPagePrefStore.getState().setDefaultPage('BV1aB4y1k7Yx', 0);
    expect('BV1aB4y1k7Yx' in useVideoPagePrefStore.getState().defaultPage).toBe(false);

    useVideoPagePrefStore.setState({ defaultPage: { BV1aB4y1k7Yx: 3 } });
    useVideoPagePrefStore.getState().setDefaultPage('BV1aB4y1k7Yx', -1);
    expect('BV1aB4y1k7Yx' in useVideoPagePrefStore.getState().defaultPage).toBe(false);

    useVideoPagePrefStore.setState({ defaultPage: { BV1aB4y1k7Yx: 3 } });
    useVideoPagePrefStore.getState().setDefaultPage('BV1aB4y1k7Yx', 2.5);
    expect('BV1aB4y1k7Yx' in useVideoPagePrefStore.getState().defaultPage).toBe(false);
  });

  it('setDefaultPage(bvid, 1) 对未存在的 key 无副作用', () => {
    useVideoPagePrefStore.getState().setDefaultPage('BV1aB4y1k7Yx', 1);
    expect(useVideoPagePrefStore.getState().defaultPage).toEqual({});
  });

  it('空 bvid 不写入', () => {
    useVideoPagePrefStore.getState().setDefaultPage('', 3);
    expect(useVideoPagePrefStore.getState().defaultPage).toEqual({});
  });

  it('clearDefaultPage 删除指定 key', () => {
    useVideoPagePrefStore.setState({ defaultPage: { BV1: 3, BV2: 5 } });
    useVideoPagePrefStore.getState().clearDefaultPage('BV1');
    expect(useVideoPagePrefStore.getState().defaultPage).toEqual({ BV2: 5 });
  });

  it('clearDefaultPage 对不存在的 key 不修改 state（引用稳定）', () => {
    const before = { BV1: 3 };
    useVideoPagePrefStore.setState({ defaultPage: before });
    useVideoPagePrefStore.getState().clearDefaultPage('BVX');
    expect(useVideoPagePrefStore.getState().defaultPage).toBe(before);
  });

  it('getDefaultPage 缺省返回 1', () => {
    expect(useVideoPagePrefStore.getState().getDefaultPage('BVX')).toBe(1);
  });

  it('getDefaultPage 命中返回 page', () => {
    useVideoPagePrefStore.setState({ defaultPage: { BV1: 7 } });
    expect(useVideoPagePrefStore.getState().getDefaultPage('BV1')).toBe(7);
  });
});
