import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 从 URL 或数字字符串中提取 B 站 UID
 * 支持：纯数字、`https://space.bilibili.com/123456`
 */
export function getBilibiliMidByURL(upUrl: string): string {
  if (/^\d+$/.test(upUrl)) return upUrl;
  const match = upUrl.match(/space\.bilibili\.com\/(\d+)/);
  return match ? match[1] : '';
}

/** 数字格式化：>=1 万显示为 X.X 万 */
export function formatNumber10K(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return String(num);
}

/** URL 协议修正：`//` 前缀补 https；http 替换为 https */
export function urlPrefixFixed(url: string): string {
  return String(url || '')
    .replace(/^\/\//, 'https://')
    .replace(/^http:\/\//, 'https://');
}

/**
 * B 站 CDN 缩略图后缀拼接
 *
 * B 站 hdslb 等 CDN 支持 `@{w}w_{h}h_1c.webp` 后缀返回缩略图。
 * 例：`https://i0.hdslb.com/bfs/archive/xxx.jpg@200w_125h_1c.webp`
 *
 * 用途：列表页大量视频封面用缩略图替代原图，可减少 50%+ 流量。
 *
 * 行为契约：
 * - 输入空串 → 返回空串（不抛错，让上层 <img> 走 fallback）
 * - 已有 `@xxx` 后缀 → 不重复追加（避免双重处理）
 * - 自动 urlPrefixFixed 修正协议
 * - 仅对 hdslb/biliimg 等 B 站域名生效；非 B 站域名原样返回（避免污染）
 */
export function bilibiliThumbUrl(url: string, width: number, height: number): string {
  if (!url) return '';
  const fixed = urlPrefixFixed(url);
  if (fixed.includes('@')) return fixed;
  if (!/(hdslb\.com|biliimg\.com|bfs)/.test(fixed)) return fixed;
  return `${fixed}@${width}w_${height}h_1c.webp`;
}
