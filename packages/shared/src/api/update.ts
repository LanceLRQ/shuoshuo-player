/**
 * 检查最新版本 API
 *
 * 主端点（CDN 加速，国内快）：download.hutao.wiki 镜像 version.json
 * 备端点（兜底）：GitHub Releases API
 *
 * 设计原则：
 * - 不复用 axios（bilibiliService / cloudService 含 wbi 拦截器与会话失效处理，与本场景无关）
 * - 静默失败：网络错误 / JSON 损坏 / 端点 404 均返回 null，不抛异常给调用方
 * - 5 秒 timeout 防卡死
 * - 不带认证（公开端点）
 *
 * HTTP 实现来自 PlatformBridge.http（web/扩展用 fetch，Tauri 用 plugin-http）
 */
import { isValidVersion, normalizeTag } from '../utils/version-compare';
import { getPlatformBridge } from '../platform';

const PRIMARY_ENDPOINT =
  'https://download.hutao.wiki/shuoshuo-player/releases/latest/download/version.json';

const FALLBACK_ENDPOINT = 'https://api.github.com/repos/LanceLRQ/shuoshuo-player/releases/latest';

const REQUEST_TIMEOUT_MS = 5000;

export type UpdateChannel = 'beta' | 'stable';

export interface UpdateInfo {
  /** 纯数字版本号，无 v 前缀（如 "1.9.1"） */
  version: string;
  /** GitHub tag 名（含 v 前缀，如 "v1.9.1"） */
  tag: string;
  /** 通道：1.x = beta，2.x+ = stable（仅参考，UI 可据此显示徽章） */
  channel: UpdateChannel;
  /** 发布时间 ISO 字符串 */
  pub_date: string;
  /** GitHub Release 页面 URL（用户点"查看更新"跳转目标） */
  release_url: string;
  /** Release notes 详情页 URL（默认与 release_url 同） */
  notes_url: string;
}

/** 从 version 字段派生 channel：1.x = beta，其他 = stable */
function inferChannel(version: string): UpdateChannel {
  return /^1\./.test(version) ? 'beta' : 'stable';
}

/** 校验 fetch 回来的 JSON 是否符合 UpdateInfo 形状 */
function parseUpdateInfo(raw: unknown): UpdateInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const version = typeof obj.version === 'string' ? obj.version : null;
  if (!version || !isValidVersion(version)) return null;

  const tag = typeof obj.tag === 'string' ? obj.tag : `v${version}`;
  const channel: UpdateChannel = obj.channel === 'stable' ? 'stable' : inferChannel(version);
  const pub_date = typeof obj.pub_date === 'string' ? obj.pub_date : '';
  const release_url = typeof obj.release_url === 'string' ? obj.release_url : '';
  const notes_url = typeof obj.notes_url === 'string' ? obj.notes_url : release_url;

  if (!release_url) return null;

  return { version, tag, channel, pub_date, release_url, notes_url };
}

/**
 * 把 GitHub Releases API 返回的 release 对象转成 UpdateInfo
 *
 * GitHub API 字段：
 * - tag_name: "v1.9.1"
 * - html_url: "https://github.com/.../releases/tag/v1.9.1"
 * - published_at: "2026-05-15T10:30:00Z"
 * - prerelease: boolean
 */
function parseGithubRelease(raw: unknown): UpdateInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const tag = typeof obj.tag_name === 'string' ? obj.tag_name : null;
  if (!tag) return null;

  const version = normalizeTag(tag);
  if (!isValidVersion(version)) return null;

  const release_url = typeof obj.html_url === 'string' ? obj.html_url : '';
  if (!release_url) return null;

  const pub_date = typeof obj.published_at === 'string' ? obj.published_at : '';
  // prerelease=true 优先；否则按版本号区间推断（与镜像 version.json 一致）
  const channel: UpdateChannel = obj.prerelease === true ? 'beta' : inferChannel(version);

  return {
    version,
    tag,
    channel,
    pub_date,
    release_url,
    notes_url: release_url,
  };
}

/** 用平台 http 客户端发 GET，5 秒超时；任何异常返回 null */
async function safeGet(url: string): Promise<unknown | null> {
  const bridge = getPlatformBridge();
  if (!bridge.http) {
    if (typeof console !== 'undefined') {
      console.debug('[update] PlatformBridge.http unavailable, skip', url);
    }
    return null;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller && typeof setTimeout !== 'undefined'
      ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      : null;

  try {
    const json = await bridge.http.getJson(url, controller?.signal);
    return json;
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.debug('[update] fetch failed', url, e);
    }
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 拉取最新版本信息
 *
 * 流程：先试主端点（镜像），失败 fallback GitHub API。
 * 全部失败返回 null（调用方静默处理）。
 */
export async function fetchLatestVersion(): Promise<UpdateInfo | null> {
  const primary = await safeGet(PRIMARY_ENDPOINT);
  const fromPrimary = primary ? parseUpdateInfo(primary) : null;
  if (fromPrimary) return fromPrimary;

  const fallback = await safeGet(FALLBACK_ENDPOINT);
  const fromFallback = fallback ? parseGithubRelease(fallback) : null;
  return fromFallback;
}

/** 仅供测试覆盖端点常量 */
export const __TEST_ONLY__ = {
  PRIMARY_ENDPOINT,
  FALLBACK_ENDPOINT,
  parseUpdateInfo,
  parseGithubRelease,
};
