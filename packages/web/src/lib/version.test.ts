import { describe, it, expect } from 'vitest';
import { isBetaVersion, APP_VERSION, IS_BETA_VERSION } from './version';

describe('isBetaVersion', () => {
  it.each([
    ['1.0.0', true],
    ['1.9.0', true],
    ['1.9.5', true],
    ['1.10.0', true],
    ['2.0.0', false],
    ['2.1.3', false],
    ['10.0.0', false],
    ['', false],
    ['x.y.z', false],
  ])('%s → %s', (v, expected) => {
    expect(isBetaVersion(v)).toBe(expected);
  });
});

describe('APP_VERSION', () => {
  it('编译期注入的版本号格式合法（SemVer 主体或 Chrome MV3 manifest 1-4 段数字）', () => {
    expect(APP_VERSION).toMatch(/^\d+(\.\d+){1,3}$/);
  });

  it('IS_BETA_VERSION 与 APP_VERSION 同步', () => {
    expect(IS_BETA_VERSION).toBe(isBetaVersion(APP_VERSION));
  });
});
