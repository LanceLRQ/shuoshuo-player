/**
 * Tauri 音频 URL 转换器
 *
 * 把 B 站 m4s URL 包装为 bili-stream://localhost/?url=ENCODED 形式，
 * 让 Howler 创建的 audio 标签的浏览器原生 fetch 走 Rust 端的 custom protocol
 * handler，由 Rust 注入 Cookie/Origin/Referer/UA 绕过反盗链。
 *
 * 仅对已知 B 站音频/视频域生效，其他 URL 透传，避免误代理。
 */

// ⚠️ 双端同步：新增域名时必须同时更新 packages/desktop/src-tauri/src/commands/audio_proxy.rs
// 中的 ALLOWED_HOST_SUFFIXES，否则 Tauri Rust 代理会以 403 (host not allowed) 拒收
const PROXY_HOST_SUFFIXES = [
  '.bilivideo.com',
  '.akamaized.net',
  '.hdslb.com',
  // 第三方音频源（需注入 Referer + UA 模拟 B 站请求）；与 Chrome 扩展 rules.json #9 同步
  '.mountaintoys.cn',
];
const PROXY_HOST_PREFIXES = ['upos-'];
const PROXY_SCHEME_PREFIX = 'bili-stream://';

/** 判断 host 是否需要走 Tauri proxy */
export function shouldProxyHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (PROXY_HOST_SUFFIXES.some((s) => lower.endsWith(s))) return true;
  if (PROXY_HOST_PREFIXES.some((p) => lower.startsWith(p))) return true;
  return false;
}

/** 把原始 URL 包装为 bili-stream:// 协议 URL；非命中域名 / 解析失败时透传 */
export function transformBilibiliAudioUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  // 幂等：已经是 bili-stream:// 不重复包装
  if (rawUrl.startsWith(PROXY_SCHEME_PREFIX)) return rawUrl;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  // 用 hostname（不含端口）做白名单匹配：B 站 mcdn 第三方源会带非标端口（如 :4483），
  // 用 parsed.host 会把 '809al93l.edge.mountaintoys.cn:4483' 与 '.mountaintoys.cn' 比对失败
  if (!shouldProxyHost(parsed.hostname)) return rawUrl;
  return `${PROXY_SCHEME_PREFIX}localhost/?url=${encodeURIComponent(rawUrl)}`;
}
