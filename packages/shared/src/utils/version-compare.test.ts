import { describe, it, expect } from 'vitest';
import { compareVersion, isValidVersion, isNewerVersion, normalizeTag } from './version-compare';

describe('isValidVersion', () => {
  it.each([
    ['1.9.0', true],
    ['1.0', true],
    ['2', true],
    ['1.9.0.1', true],
    ['1.9.0.1.2', false],
    ['v1.9.0', false],
    ['1.9.0-beta.1', false],
    ['1.9.0-rc.1', false],
    ['', false],
    ['abc', false],
    ['1.x', false],
    ['1..0', false],
  ])('%s -> %s', (v, expected) => {
    expect(isValidVersion(v)).toBe(expected);
  });
});

describe('compareVersion', () => {
  it('相等', () => {
    expect(compareVersion('1.9.0', '1.9.0')).toBe(0);
    expect(compareVersion('1.9', '1.9.0')).toBe(0);
    expect(compareVersion('2', '2.0.0')).toBe(0);
  });

  it('a < b', () => {
    expect(compareVersion('1.9.0', '1.9.1')).toBe(-1);
    expect(compareVersion('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersion('1.9.0', '2.0.0')).toBe(-1);
    expect(compareVersion('1.9', '1.9.1')).toBe(-1);
  });

  it('a > b', () => {
    expect(compareVersion('1.9.1', '1.9.0')).toBe(1);
    expect(compareVersion('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersion('2.0.0', '1.9.99')).toBe(1);
    expect(compareVersion('10.0.0', '2.99.99')).toBe(1);
  });

  it('数字段而非字典序：1.10 > 1.9', () => {
    expect(compareVersion('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersion('1.2.10', '1.2.9')).toBe(1);
  });

  it('段数不同补零对齐', () => {
    expect(compareVersion('1.9.0', '1.9')).toBe(0);
    expect(compareVersion('1.9.0.0', '1.9.0')).toBe(0);
    expect(compareVersion('1.9.0.1', '1.9.0')).toBe(1);
  });

  it('非法输入抛错', () => {
    expect(() => compareVersion('abc', '1.0.0')).toThrow();
    expect(() => compareVersion('1.0.0', '')).toThrow();
    expect(() => compareVersion('v1.0.0', '1.0.0')).toThrow();
  });
});

describe('isNewerVersion', () => {
  it('严格新返回 true', () => {
    expect(isNewerVersion('1.9.1', '1.9.0')).toBe(true);
  });
  it('相等返回 false', () => {
    expect(isNewerVersion('1.9.0', '1.9.0')).toBe(false);
  });
  it('更旧返回 false', () => {
    expect(isNewerVersion('1.9.0', '1.9.1')).toBe(false);
  });
});

describe('normalizeTag', () => {
  it('剥离 v 前缀', () => {
    expect(normalizeTag('v1.9.0')).toBe('1.9.0');
    expect(normalizeTag('v2.0.0')).toBe('2.0.0');
  });
  it('无前缀保持', () => {
    expect(normalizeTag('1.9.0')).toBe('1.9.0');
  });
  it('仅剥离首字符 v，不影响后续', () => {
    expect(normalizeTag('v1.9.0v')).toBe('1.9.0v');
  });
});
