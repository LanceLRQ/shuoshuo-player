/**
 * TrackId：统一表达"播放/收藏的最小单位"
 *
 * 形态：
 * - 纯 bvid（如 'BV1aB4y1k7Yx'）→ 表示"整个投稿"，播放时按默认 P / 第一 P 取流
 * - bvid:p<n>（如 'BV1aB4y1k7Yx:p3'）→ 表示"显式锁定该 P"，n >= 2
 *
 * 不变量：
 * - page === 1 永远表达为纯 bvid，不允许出现 ':p1' 后缀
 * - page 必须为 >= 2 的正整数
 * - bvid 形态约束：BV 前缀 + 字母数字
 *
 * 解析失败的字符串视为"非合法 TrackId"，parseTrackId 返回 null，
 * 调用方应用 trackIdToBvid 做兜底转换以兼容历史存量数据。
 */

const TRACK_ID_PATTERN = /^(BV[A-Za-z0-9]+)(?::p(\d+))?$/;

export interface ParsedTrackId {
  bvid: string;
  /** 显式指定的分 P 序号；缺失表示"按默认/首 P" */
  page?: number;
}

/**
 * 解析 TrackId。
 *
 * 严格校验：
 * - 不匹配 BV 正则 → null
 * - :p0 / :p1 / :p- 等非法 page → null（注：:p1 是冗余表达，禁止）
 *
 * @returns 解析成功 → { bvid, page? }；失败 → null
 */
export function parseTrackId(id: string): ParsedTrackId | null {
  if (typeof id !== 'string' || id.length === 0) return null;
  const m = TRACK_ID_PATTERN.exec(id);
  if (!m) return null;
  const bvid = m[1]!;
  const pageStr = m[2];
  if (pageStr === undefined) return { bvid };
  const page = Number(pageStr);
  if (!Number.isInteger(page) || page < 2) return null;
  return { bvid, page };
}

/**
 * 组装 TrackId。
 *
 * 规则：
 * - page 缺省、undefined、null、1 → 返回纯 bvid
 * - page >= 2 → 返回 `${bvid}:p${page}`
 * - page < 1 或非整数 → 视为非法，回退到纯 bvid（不抛错以保持调用侧简单）
 */
export function buildTrackId(bvid: string, page?: number | null): string {
  if (page == null) return bvid;
  if (!Number.isInteger(page) || page <= 1) return bvid;
  return `${bvid}:p${page}`;
}

/**
 * 提取 bvid。解析失败时返回原值（兼容历史存量数据：可能存在非 BV 开头的脏数据，
 * 例如旧版 numeric aid 字符串）。
 */
export function trackIdToBvid(id: string): string {
  const parsed = parseTrackId(id);
  if (parsed) return parsed.bvid;
  // fallback：截到第一个 ':' 之前
  const colonIdx = id.indexOf(':');
  return colonIdx >= 0 ? id.slice(0, colonIdx) : id;
}

/**
 * 是否显式指定了 P（带 :p<n> 后缀）。
 *
 * 用于 UI 决策（如显式 TrackId 的 onend 永远走 next() 而非分 P 连播）。
 */
export function isExplicitPageTrackId(id: string): boolean {
  const parsed = parseTrackId(id);
  return parsed !== null && parsed.page !== undefined;
}

/**
 * 轻量后缀检测：字符串是否含 ':p' 标记（不做完整 BV 校验）。
 *
 * 用于 hydrate / persist 路径上 O(N) 扫描旧脏数据时的快速预判，
 * 避免对每条 entry 都调用完整的 parseTrackId 正则。
 */
export function hasPageSuffix(id: string): boolean {
  return typeof id === 'string' && id.includes(':p');
}
