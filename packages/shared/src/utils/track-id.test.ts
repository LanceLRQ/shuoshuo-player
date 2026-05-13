import { describe, it, expect } from 'vitest';
import { parseTrackId, buildTrackId, trackIdToBvid, isExplicitPageTrackId } from './track-id';

describe('parseTrackId', () => {
  it('解析纯 bvid', () => {
    expect(parseTrackId('BV1aB4y1k7Yx')).toEqual({ bvid: 'BV1aB4y1k7Yx' });
  });

  it('解析带 :p<n> 的 TrackId（n >= 2）', () => {
    expect(parseTrackId('BV1aB4y1k7Yx:p2')).toEqual({ bvid: 'BV1aB4y1k7Yx', page: 2 });
    expect(parseTrackId('BV1aB4y1k7Yx:p99')).toEqual({ bvid: 'BV1aB4y1k7Yx', page: 99 });
  });

  it('拒绝 :p1（page=1 应表达为纯 bvid）', () => {
    expect(parseTrackId('BV1aB4y1k7Yx:p1')).toBeNull();
  });

  it('拒绝 :p0 / :p- 等非法 page', () => {
    expect(parseTrackId('BV1aB4y1k7Yx:p0')).toBeNull();
    expect(parseTrackId('BV1aB4y1k7Yx:p-1')).toBeNull();
  });

  it('拒绝非 BV 前缀', () => {
    expect(parseTrackId('av12345')).toBeNull();
    expect(parseTrackId('12345')).toBeNull();
    expect(parseTrackId('bv1aB4y1k7Yx')).toBeNull(); // 小写
  });

  it('拒绝空串 / 非字符串', () => {
    expect(parseTrackId('')).toBeNull();
    // @ts-expect-error 测试非法输入
    expect(parseTrackId(undefined)).toBeNull();
    // @ts-expect-error 测试非法输入
    expect(parseTrackId(null)).toBeNull();
  });

  it('拒绝带额外尾随字符', () => {
    expect(parseTrackId('BV1aB4y1k7Yx:p2:extra')).toBeNull();
    expect(parseTrackId('BV1aB4y1k7Yx:p2 ')).toBeNull();
  });
});

describe('buildTrackId', () => {
  it('page 缺省 / undefined / null / 1 → 返回纯 bvid', () => {
    expect(buildTrackId('BV1aB4y1k7Yx')).toBe('BV1aB4y1k7Yx');
    expect(buildTrackId('BV1aB4y1k7Yx', undefined)).toBe('BV1aB4y1k7Yx');
    expect(buildTrackId('BV1aB4y1k7Yx', null)).toBe('BV1aB4y1k7Yx');
    expect(buildTrackId('BV1aB4y1k7Yx', 1)).toBe('BV1aB4y1k7Yx');
  });

  it('page >= 2 → 拼 :p<n>', () => {
    expect(buildTrackId('BV1aB4y1k7Yx', 2)).toBe('BV1aB4y1k7Yx:p2');
    expect(buildTrackId('BV1aB4y1k7Yx', 99)).toBe('BV1aB4y1k7Yx:p99');
  });

  it('page 非法（0 / 负 / 非整数）→ 回退纯 bvid', () => {
    expect(buildTrackId('BV1aB4y1k7Yx', 0)).toBe('BV1aB4y1k7Yx');
    expect(buildTrackId('BV1aB4y1k7Yx', -1)).toBe('BV1aB4y1k7Yx');
    expect(buildTrackId('BV1aB4y1k7Yx', 1.5)).toBe('BV1aB4y1k7Yx');
    expect(buildTrackId('BV1aB4y1k7Yx', NaN)).toBe('BV1aB4y1k7Yx');
  });
});

describe('trackIdToBvid', () => {
  it('合法 TrackId → 返回 bvid', () => {
    expect(trackIdToBvid('BV1aB4y1k7Yx')).toBe('BV1aB4y1k7Yx');
    expect(trackIdToBvid('BV1aB4y1k7Yx:p3')).toBe('BV1aB4y1k7Yx');
  });

  it('非合法字符串 → 取 ":" 前部分作为兜底', () => {
    // 历史存量场景：截到冒号前；无冒号则原值返回
    expect(trackIdToBvid('garbage')).toBe('garbage');
    expect(trackIdToBvid('weird:tag:rest')).toBe('weird');
  });
});

describe('isExplicitPageTrackId', () => {
  it('显式 :p<n> → true', () => {
    expect(isExplicitPageTrackId('BV1aB4y1k7Yx:p2')).toBe(true);
  });

  it('纯 bvid → false', () => {
    expect(isExplicitPageTrackId('BV1aB4y1k7Yx')).toBe(false);
  });

  it('非法 TrackId → false', () => {
    expect(isExplicitPageTrackId('garbage')).toBe(false);
    expect(isExplicitPageTrackId('BV1aB4y1k7Yx:p1')).toBe(false);
  });
});

describe('round-trip', () => {
  it('parse → build 等价（page 缺省）', () => {
    const parsed = parseTrackId('BV1aB4y1k7Yx');
    expect(parsed).not.toBeNull();
    expect(buildTrackId(parsed!.bvid, parsed!.page)).toBe('BV1aB4y1k7Yx');
  });

  it('parse → build 等价（带 page）', () => {
    const parsed = parseTrackId('BV1aB4y1k7Yx:p7');
    expect(parsed).not.toBeNull();
    expect(buildTrackId(parsed!.bvid, parsed!.page)).toBe('BV1aB4y1k7Yx:p7');
  });
});
