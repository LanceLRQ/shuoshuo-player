/**
 * 版本号常量与发布通道判定
 *
 * APP_VERSION 由 vite define 在编译期注入（值来自 packages/web/package.json#version），
 * 见 packages/web/vite.config.ts 的 define.__APP_VERSION__。
 *
 * Beta 通道约定：1.x 区间为 Beta，2.0+ 为稳定版。
 * 该约定在 plans/quizzical-strolling-cray.md 中明确：1.9.0 是 2.0 正式版前的预发布 Beta 通道。
 */
export const APP_VERSION = __APP_VERSION__;

/**
 * 1.x 区间为 Beta 通道；2.0+ 为稳定版。
 * 容错：版本号必须以 "1." 起始（不接受空串或非数字前缀）
 */
export function isBetaVersion(version: string): boolean {
  return /^1\./.test(version);
}

export const IS_BETA_VERSION = isBetaVersion(APP_VERSION);
