/**
 * 版本号比较工具
 *
 * 仅支持 1-4 段纯数字（与 Chrome MV3 manifest / scripts/sync-version.mjs 约束一致）。
 * 不支持 SemVer 预发布段（如 1.9.0-beta.1）：因为 Chrome 扩展 manifest 不接受，
 * 项目 release 线统一走 `1.9.0` / `1.9.1` / `1.9.0.1` 这种纯数字格式。
 *
 * 段数不同时左侧补零对齐：1.9 视为 1.9.0；2 视为 2.0.0。
 */

const VERSION_REGEX = /^\d+(\.\d+){0,3}$/;

/** 检查版本字符串是否合法（1-4 段纯数字，无前缀 v） */
export function isValidVersion(v: string): boolean {
  return typeof v === 'string' && VERSION_REGEX.test(v);
}

/**
 * 比较两个版本号
 *
 * @returns -1 a < b；0 相等；1 a > b
 * @throws 任一参数非法时抛 Error（调用方需先用 isValidVersion 校验）
 */
export function compareVersion(a: string, b: string): -1 | 0 | 1 {
  if (!isValidVersion(a)) throw new Error(`compareVersion: invalid version "${a}"`);
  if (!isValidVersion(b)) throw new Error(`compareVersion: invalid version "${b}"`);

  const segsA = a.split('.').map((s) => Number.parseInt(s, 10));
  const segsB = b.split('.').map((s) => Number.parseInt(s, 10));
  const len = Math.max(segsA.length, segsB.length);

  for (let i = 0; i < len; i++) {
    const va = segsA[i] ?? 0;
    const vb = segsB[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/** 是否 a 比 b 严格新（语法糖） */
export function isNewerVersion(a: string, b: string): boolean {
  return compareVersion(a, b) === 1;
}

/**
 * 从 GitHub release tag_name 提取版本号（去掉前缀 v）
 *
 * @example normalizeTag("v1.9.0") -> "1.9.0"
 * @example normalizeTag("1.9.0") -> "1.9.0"
 */
export function normalizeTag(tag: string): string {
  return tag.replace(/^v/, '');
}
