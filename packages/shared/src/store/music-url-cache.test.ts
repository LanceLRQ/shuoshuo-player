import { describe, it, expect, beforeEach } from 'vitest';
import { useMusicUrlCacheStore, makeCacheKey } from './music-url-cache';
import { MUSIC_URL_CACHE_TTL } from '../constants';

describe('useMusicUrlCacheStore（A5 升级后：key = bvid:cid）', () => {
  beforeEach(() => {
    useMusicUrlCacheStore.setState({ entries: {} });
  });

  it('makeCacheKey 拼接为 `${bvid}:${cid}`', () => {
    expect(makeCacheKey('BV1', 100)).toBe('BV1:100');
  });

  it('upsert 写入到 bvid:cid key，value 不再保存 cid', () => {
    useMusicUrlCacheStore.getState().upsert('BV1', 100, { playUrl: 'https://x/a' });
    const entries = useMusicUrlCacheStore.getState().entries;
    expect(entries['BV1:100']?.playUrl).toBe('https://x/a');
    expect(entries['BV1:100']?.last_update).toBeGreaterThan(0);
    expect(Object.prototype.hasOwnProperty.call(entries['BV1:100'], 'cid')).toBe(false);
    // 旧 key 形态不存在
    expect(entries['BV1']).toBeUndefined();
  });

  it('同 bvid 不同 cid 的多 P 互不覆盖', () => {
    useMusicUrlCacheStore.getState().upsert('BV1', 100, { playUrl: 'https://x/p1' });
    useMusicUrlCacheStore.getState().upsert('BV1', 200, { playUrl: 'https://x/p2' });
    const entries = useMusicUrlCacheStore.getState().entries;
    expect(entries['BV1:100']?.playUrl).toBe('https://x/p1');
    expect(entries['BV1:200']?.playUrl).toBe('https://x/p2');
  });

  it('getValid 命中未过期条目', () => {
    useMusicUrlCacheStore.getState().upsert('BV1', 100, { playUrl: 'https://x/a' });
    expect(useMusicUrlCacheStore.getState().getValid('BV1', 100)?.playUrl).toBe('https://x/a');
  });

  it('getValid 过期返回 undefined', () => {
    useMusicUrlCacheStore.setState({
      entries: {
        'BV1:100': { playUrl: 'https://x/a', last_update: 0 },
      },
    });
    expect(useMusicUrlCacheStore.getState().getValid('BV1', 100)).toBeUndefined();
  });

  it('getValid 错位 cid 返回 undefined', () => {
    useMusicUrlCacheStore.getState().upsert('BV1', 100, { playUrl: 'https://x/a' });
    expect(useMusicUrlCacheStore.getState().getValid('BV1', 999)).toBeUndefined();
  });

  it('invalidate(bvid) 清空该 bvid 下所有 P', () => {
    useMusicUrlCacheStore.setState({
      entries: {
        'BV1:100': { playUrl: 'a', last_update: Date.now() / 1000 },
        'BV1:200': { playUrl: 'b', last_update: Date.now() / 1000 },
        'BV2:300': { playUrl: 'c', last_update: Date.now() / 1000 },
      },
    });
    useMusicUrlCacheStore.getState().invalidate('BV1');
    const entries = useMusicUrlCacheStore.getState().entries;
    expect(entries['BV1:100']).toBeUndefined();
    expect(entries['BV1:200']).toBeUndefined();
    expect(entries['BV2:300']).toBeDefined();
  });

  it('invalidate() 清空全部', () => {
    useMusicUrlCacheStore.setState({
      entries: {
        'BV1:100': { playUrl: 'a', last_update: Date.now() / 1000 },
        'BV2:200': { playUrl: 'b', last_update: Date.now() / 1000 },
      },
    });
    useMusicUrlCacheStore.getState().invalidate();
    expect(useMusicUrlCacheStore.getState().entries).toEqual({});
  });

  it('invalidate 对不命中 bvid 不变更引用（性能保障）', () => {
    const before = { 'BV1:100': { playUrl: 'a', last_update: Date.now() / 1000 } };
    useMusicUrlCacheStore.setState({ entries: before });
    useMusicUrlCacheStore.getState().invalidate('BVX');
    expect(useMusicUrlCacheStore.getState().entries).toBe(before);
  });

  it('persistSnapshot 剔除过期项与不含 ":" 的旧形态 key', () => {
    const now = Math.floor(Date.now() / 1000);
    useMusicUrlCacheStore.setState({
      entries: {
        'BV1:100': { playUrl: 'fresh', last_update: now },
        'BV2:200': { playUrl: 'expired', last_update: now - MUSIC_URL_CACHE_TTL - 1 },
        // 旧形态 key（A5 前的 bvid 索引）应被丢弃
        BV3: { playUrl: 'legacy', last_update: now },
      },
    });
    const snap = useMusicUrlCacheStore.getState().persistSnapshot();
    expect(snap.entries['BV1:100']).toBeDefined();
    expect(snap.entries['BV2:200']).toBeUndefined();
    expect(snap.entries['BV3']).toBeUndefined();
  });
});
