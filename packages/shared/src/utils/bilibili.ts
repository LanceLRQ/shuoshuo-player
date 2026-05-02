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
