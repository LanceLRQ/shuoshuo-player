import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { BilibiliVideo, BilibiliVideoPage } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 投稿字段拾取与映射（移植 v1 pickVideosField）
 *
 * 三种 B 站接口返回结构差异较大，需归一化到 BilibiliVideo 形状才能存入 entity store：
 *
 * - `default`：UP 主投稿列表 vlist 项（/x/space/wbi/arc/search），
 *   字段名与 BilibiliVideo 直接对应，无需映射
 *
 * - `view`：视频详情接口（/x/web-interface/wbi/view），需映射：
 *     ctime → created
 *     duration → length
 *     stat.view → play
 *     stat.reply → comment
 *     owner.name → author
 *     owner.mid → mid
 *     desc → description
 *
 * - `fav_folder`：收藏夹 medias 项（/x/v3/fav/resource/list），需映射：
 *     id → aid
 *     cover → pic
 *     ctime → created
 *     duration → length
 *     cnt_info.play → play
 *     cnt_info.reply → comment
 *     upper.name → author
 *     upper.mid → mid
 *     intro → description
 */
type PickMode = 'default' | 'fav_folder' | 'view';
type RawItem = Record<string, unknown> & { bvid: string };
type Mapped = Partial<BilibiliVideo> & { bvid: string };

/** view.pages[] 原始项 → BilibiliVideoPage（裁剪到 cid/page/part/duration 四字段） */
function mapPagesField(raw: unknown): BilibiliVideoPage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: BilibiliVideoPage[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const obj = p as { cid?: number; page?: number; part?: string; duration?: number };
    if (typeof obj.cid !== 'number' || typeof obj.page !== 'number') continue;
    out.push({
      cid: obj.cid,
      page: obj.page,
      part: typeof obj.part === 'string' ? obj.part : '',
      duration: typeof obj.duration === 'number' ? obj.duration : 0,
    });
  }
  return out.length > 0 ? out : undefined;
}

function mapViewItem(i: RawItem): Mapped {
  const stat = (i.stat ?? {}) as { view?: number; reply?: number };
  const owner = (i.owner ?? {}) as { name?: string; mid?: number };
  return {
    aid: i.aid as number,
    bvid: i.bvid,
    pic: i.pic as string,
    title: i.title as string,
    sub_title: i.sub_title as string,
    is_union_video: i.is_union_video as boolean,
    created: i.ctime as number,
    length: i.duration as string,
    play: stat.view,
    comment: stat.reply,
    author: owner.name,
    mid: owner.mid,
    // view 接口返回单 P 的 cid；fetchMusicUrl 走 playurl 时可直接复用，省一次 view 调用
    cid: typeof i.cid === 'number' ? (i.cid as number) : undefined,
    // 分 P 元数据：view 接口返回 videos（总数）+ pages[]（每 P cid/page/part/duration）
    videos: typeof i.videos === 'number' ? (i.videos as number) : undefined,
    pages: mapPagesField(i.pages),
    description: (i.desc ?? i.description) as string,
  };
}

function mapFavFolderItem(i: RawItem): Mapped {
  const cnt = (i.cnt_info ?? {}) as { play?: number; reply?: number };
  const upper = (i.upper ?? {}) as { name?: string; mid?: number };
  return {
    aid: i.id as number,
    bvid: i.bvid,
    pic: i.cover as string,
    title: i.title as string,
    sub_title: i.sub_title as string,
    is_union_video: i.is_union_video as boolean,
    created: i.ctime as number,
    length: i.duration as string,
    play: cnt.play,
    comment: cnt.reply,
    author: upper.name,
    mid: upper.mid,
    description: i.intro as string,
  };
}

export function pickVideosFields(
  list: { bvid: string } | Array<{ bvid: string }>,
  mode: PickMode = 'default',
): Mapped[] {
  const arr = (Array.isArray(list) ? list : [list]) as RawItem[];
  if (mode === 'default') return arr as unknown as Mapped[];
  const mapper = mode === 'view' ? mapViewItem : mapFavFolderItem;
  return arr.map(mapper);
}

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
