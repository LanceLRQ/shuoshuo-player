// B 站音频 / 视频流代理（custom URI scheme: bili-stream://）
//
// 背景：Tauri WebView 内 audio 标签 / img 等浏览器原生 fetch 受同源 + 反盗链限制，
// 直连 *.bilivideo.com 等域会被 B 站 403。axios 已用 plugin-http adapter 解决，
// 但 audio 标签前端无法注入 headers，必须由 Rust 后端代理转发。
//
// 协议格式：bili-stream://localhost/?url=ENCODED_REAL_URL
// 流程：解码 url → 域名白名单校验 → 命中本地缓存？是→读盘解混返回 / 否→reqwest
// 注入 Referer/Origin/UA/Cookie 下载 + 写缓存 → 转发响应 206 Partial Content。
//
// Range 分段：handler 主动给上游设上限 1MB（clamp_range）。Tauri v2 UriSchemeResponder
// 不支持流式，但分段后每段下载快，audio 标签按 Content-Range 自动请求下一段，实现
// "边下边播"。每段独立缓存（cache_key 含 range），重播秒命中。

use once_cell::sync::Lazy;
use tauri::Manager;

use crate::commands::audio_cache::{self, AudioCacheState};
use crate::commands::auth::CookieState;

const BILIBILI_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const BILIBILI_REFERER: &str = "https://www.bilibili.com/";
const BILIBILI_ORIGIN: &str = "https://www.bilibili.com";

// 与前端 transformBilibiliAudioUrl 的白名单同步；新增域必须双端同步
const ALLOWED_HOST_SUFFIXES: &[&str] = &[".bilivideo.com", ".akamaized.net", ".hdslb.com"];
const ALLOWED_HOST_PREFIXES: &[&str] = &["upos-"];

/// 单次代理上限（chunk 大小）。
///
/// 4 MB 的权衡：
/// - 千兆带宽：~50ms 下完一段，首播延迟可接受
/// - 50 KB/s 慢速：每段 80s，buffer 满 1-2 段就开播
/// - 整曲 5-10 MB → 仅 2-3 次 reqwest（vs 1MB 时 6 次），HTTP 调用降为 1/3
/// - 重复下载浪费 4MB（已用 single-flight 防止并发重复）
const MAX_CHUNK_BYTES: u64 = 4 * 1024 * 1024;

/// 解析 Range 头：`bytes=N-` / `bytes=N-M` → (start, Some(end)) 或 (start, None)
pub fn parse_range(range_header: Option<&str>) -> Option<(u64, Option<u64>)> {
    let raw = range_header?;
    let stripped = raw.strip_prefix("bytes=")?.trim();
    let mut parts = stripped.split('-');
    let start = parts.next()?.parse::<u64>().ok()?;
    let end_str = parts.next()?;
    if end_str.is_empty() {
        Some((start, None))
    } else {
        let end = end_str.parse::<u64>().ok()?;
        Some((start, Some(end)))
    }
}

/// 复用单例 reqwest Client（与 spider.rs 同模式，避免每请求重建 TLS 连接池）
static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(reqwest::Client::new);

/// 从 bili-stream://...?url=ENCODED 中提取真实目标 URL
pub fn extract_target_url(req_uri: &str) -> Result<String, String> {
    // bili-stream://localhost/?url=ENCODED  → 用 url crate 解析
    let parsed = url::Url::parse(req_uri).map_err(|e| format!("parse req uri failed: {}", e))?;
    let raw = parsed
        .query_pairs()
        .find(|(k, _)| k == "url")
        .map(|(_, v)| v.into_owned())
        .ok_or_else(|| "missing url query parameter".to_string())?;
    if raw.is_empty() {
        return Err("empty url parameter".to_string());
    }
    Ok(raw)
}

/// 域名白名单校验（防止变成开放代理）
pub fn is_allowed_host(target_url: &str) -> bool {
    let parsed = match url::Url::parse(target_url) {
        Ok(u) => u,
        Err(_) => return false,
    };
    let host = match parsed.host_str() {
        Some(h) => h.to_lowercase(),
        None => return false,
    };
    if ALLOWED_HOST_SUFFIXES.iter().any(|s| host.ends_with(s)) {
        return true;
    }
    if ALLOWED_HOST_PREFIXES.iter().any(|p| host.starts_with(p)) {
        return true;
    }
    false
}

fn error_response(status: u16, message: &str) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(status)
        .header("content-type", "text/plain; charset=utf-8")
        .body(message.as_bytes().to_vec())
        .unwrap_or_else(|_| {
            // 极端兜底：构造最小响应避免 panic
            tauri::http::Response::new(Vec::new())
        })
}

/// 从上游 Content-Range "bytes start-end/total" 中提取 total
pub fn parse_total_from_content_range(content_range: &str) -> Option<u64> {
    let after_slash = content_range.split('/').nth(1)?.trim();
    after_slash.parse::<u64>().ok()
}

/// 计算 audio Range 命中的 chunk 边界（chunk_start, chunk_end_inclusive）
pub fn chunk_bounds(audio_start: u64) -> (u64, u64, u64) {
    let chunk_index = audio_start / MAX_CHUNK_BYTES;
    let chunk_start = chunk_index * MAX_CHUNK_BYTES;
    let chunk_end_inclusive = chunk_start + MAX_CHUNK_BYTES - 1;
    (chunk_index, chunk_start, chunk_end_inclusive)
}

/// custom URI scheme handler：异步代理 B 站音频 / 视频流（chunk-aligned 缓存）
///
/// 核心策略：audio 标签会发大量碎片小 Range（mp4 atom 探测），但都落在 1 MB chunk
/// 边界内。handler 一次下载整段 1 MB 缓存到本地，后续 audio 任意小 Range 都从
/// cache 切片返回，避免重复 reqwest 调用（千兆带宽下 RTT 串行才是真正瓶颈）。
pub fn handle_audio_proxy<R: tauri::Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: tauri::http::Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    let req_uri = request.uri().to_string();
    let range_header = request
        .headers()
        .get("range")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    tauri::async_runtime::spawn(async move {
        let real_url = match extract_target_url(&req_uri) {
            Ok(u) => u,
            Err(e) => {
                eprintln!("[audio_proxy] extract failed: {}", e);
                responder.respond(error_response(400, &e));
                return;
            }
        };
        if !is_allowed_host(&real_url) {
            eprintln!("[audio_proxy] host not allowed: {}", real_url);
            responder.respond(error_response(403, "host not allowed"));
            return;
        }

        // 解析 audio 请求的 Range（不强制 clamp，按需切片）
        let (audio_start, audio_end_opt) =
            parse_range(range_header.as_deref()).unwrap_or((0, None));
        let (chunk_index, chunk_start, chunk_end_inclusive) = chunk_bounds(audio_start);
        let cache_key = audio_cache::compute_chunk_cache_key(&real_url, chunk_index);

        let cache_state_opt = app.try_state::<AudioCacheState>();

        // 1. 缓存命中（无锁路径）：直接切片返回（高频路径不打日志）
        if let Some(cs) = cache_state_opt.as_ref() {
            if let Some(hit) = audio_cache::try_load(cs.inner(), &cache_key).await {
                let resp = build_slice_response(
                    &hit.bytes,
                    chunk_start,
                    audio_start,
                    audio_end_opt,
                    chunk_end_inclusive,
                    hit.total_size,
                    &hit.content_type,
                );
                responder.respond(resp);
                return;
            }
        }

        // 2. single-flight：拿到 per-chunk inflight 锁后 double-check 缓存
        // 防止 audio 并发探测同一 chunk 时多次 reqwest（千兆带宽下浪费 4MB / 次）
        let inflight_lock = cache_state_opt
            .as_ref()
            .map(|cs| cs.inner().inflight_lock_for(&cache_key));
        let _inflight_guard = if let Some(lock) = inflight_lock.as_ref() {
            Some(lock.lock().await)
        } else {
            None
        };

        // double-check：等锁期间前一个请求可能已写完 cache（高频路径不打日志）
        if let Some(cs) = cache_state_opt.as_ref() {
            if let Some(hit) = audio_cache::try_load(cs.inner(), &cache_key).await {
                let resp = build_slice_response(
                    &hit.bytes,
                    chunk_start,
                    audio_start,
                    audio_end_opt,
                    chunk_end_inclusive,
                    hit.total_size,
                    &hit.content_type,
                );
                responder.respond(resp);
                return;
            }
        }

        // 3. 缓存未命中：reqwest 下载整个 chunk（chunk_start..=chunk_end_inclusive）
        let cookies_snapshot: Vec<crate::commands::auth::CookieRecord> = {
            let state = app.state::<CookieState>();
            state.0.lock().map(|g| g.clone()).unwrap_or_default()
        };
        let cookie_str = cookies_snapshot
            .iter()
            .map(|c| format!("{}={}", c.name, c.value))
            .collect::<Vec<_>>()
            .join("; ");

        let chunk_range_header = format!("bytes={}-{}", chunk_start, chunk_end_inclusive);
        let mut builder = HTTP_CLIENT
            .get(&real_url)
            .header("Referer", BILIBILI_REFERER)
            .header("Origin", BILIBILI_ORIGIN)
            .header("User-Agent", BILIBILI_UA)
            .header("Range", &chunk_range_header);
        if !cookie_str.is_empty() {
            // clone 给 builder，cookie_str 保留供后续 prefetch spawn 使用
            builder = builder.header("Cookie", cookie_str.clone());
        }

        let dl_start = std::time::Instant::now();
        match builder.send().await {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let upstream_headers = resp.headers().clone();
                let chunk_body = resp.bytes().await.unwrap_or_default().to_vec();
                let elapsed_ms = dl_start.elapsed().as_millis();
                let kb_per_s = if elapsed_ms > 0 {
                    (chunk_body.len() as u128) * 1000 / elapsed_ms / 1024
                } else {
                    0
                };

                let upstream_content_type = upstream_headers
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("audio/mp4")
                    .to_string();
                let total_size_opt = upstream_headers
                    .get("content-range")
                    .and_then(|v| v.to_str().ok())
                    .and_then(parse_total_from_content_range);

                eprintln!(
                    "[audio_proxy] chunk={} status={} bytes={} elapsed={}ms speed={}KB/s",
                    chunk_index, status, chunk_body.len(), elapsed_ms, kb_per_s
                );

                // 上游错误：直接转发原响应（不写缓存）
                if status != 206 && status != 200 {
                    let mut rb = tauri::http::Response::builder().status(status);
                    for h in ["content-type", "content-length", "content-range"] {
                        if let Some(v) = upstream_headers.get(h) {
                            if let Ok(s) = v.to_str() {
                                rb = rb.header(h, s);
                            }
                        }
                    }
                    let r = rb
                        .body(chunk_body)
                        .unwrap_or_else(|_| error_response(500, "build resp failed"));
                    responder.respond(r);
                    return;
                }

                // 总大小未知 → 退化处理：直接转发上游 body（不切片不缓存）
                let total_size = match total_size_opt {
                    Some(t) => t,
                    None => {
                        let mut rb = tauri::http::Response::builder().status(status);
                        for h in [
                            "content-type",
                            "content-length",
                            "accept-ranges",
                            "content-range",
                        ] {
                            if let Some(v) = upstream_headers.get(h) {
                                if let Ok(s) = v.to_str() {
                                    rb = rb.header(h, s);
                                }
                            }
                        }
                        let r = rb
                            .body(chunk_body)
                            .unwrap_or_else(|_| error_response(500, "build resp failed"));
                        responder.respond(r);
                        return;
                    }
                };

                // 同步等待写缓存完成（在 inflight 锁内），后续等锁的并发请求拿锁后能立即从
                // cache 读到。写盘 ~10ms 数量级，对响应延迟影响可忽略
                if let Some(cs) = cache_state_opt.as_ref() {
                    if let Err(e) = audio_cache::store(
                        cs.inner(),
                        &cache_key,
                        &chunk_body,
                        total_size,
                        &upstream_content_type,
                    )
                    .await
                    {
                        eprintln!("[audio_cache] store failed: {}", e);
                    }
                }

                // 切片返回 audio 实际请求范围
                let resp = build_slice_response(
                    &chunk_body,
                    chunk_start,
                    audio_start,
                    audio_end_opt,
                    chunk_end_inclusive,
                    total_size,
                    &upstream_content_type,
                );
                responder.respond(resp);

                // 跨段预取：当前 chunk 下完后，后台预下下一个 chunk（如尚未到文件末尾且未缓存）
                // 与 handler miss 路径走相同 inflight 锁，避免并发重复
                let next_index = chunk_index + 1;
                if next_index * MAX_CHUNK_BYTES < total_size {
                    let app_clone = app.clone();
                    let url_clone = real_url.clone();
                    let cookie_clone = cookie_str.clone();
                    let ua_clone = upstream_content_type.clone();
                    tauri::async_runtime::spawn(async move {
                        prefetch_chunk(app_clone, url_clone, cookie_clone, ua_clone, next_index)
                            .await;
                    });
                }
            }
            Err(e) => {
                eprintln!("[audio_proxy] reqwest send failed: {}", e);
                responder.respond(error_response(502, &e.to_string()));
            }
        }
    });
}

/// 后台预取下一个 chunk：仅在缓存未命中时触发实际下载，命中即跳过。
/// 与 handler miss 路径走相同 inflight 锁，并发安全。
async fn prefetch_chunk<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    real_url: String,
    cookie_str: String,
    _content_type_hint: String,
    chunk_index: u64,
) {
    let cache_state_opt = app.try_state::<AudioCacheState>();
    let cache_key = audio_cache::compute_chunk_cache_key(&real_url, chunk_index);

    // 1. 缓存已有？跳过
    if let Some(cs) = cache_state_opt.as_ref() {
        if audio_cache::try_load(cs.inner(), &cache_key).await.is_some() {
            return;
        }
    }

    // 2. 拿 inflight 锁（如果别的请求正在下，等它完成）
    let inflight_lock = cache_state_opt
        .as_ref()
        .map(|cs| cs.inner().inflight_lock_for(&cache_key));
    let _guard = if let Some(lock) = inflight_lock.as_ref() {
        Some(lock.lock().await)
    } else {
        None
    };

    // 3. double-check：等锁期间前一个请求可能已写完
    if let Some(cs) = cache_state_opt.as_ref() {
        if audio_cache::try_load(cs.inner(), &cache_key).await.is_some() {
            return;
        }
    }

    // 4. 真正预取
    let chunk_start = chunk_index * MAX_CHUNK_BYTES;
    let chunk_end_inclusive = chunk_start + MAX_CHUNK_BYTES - 1;
    let chunk_range_header = format!("bytes={}-{}", chunk_start, chunk_end_inclusive);
    let mut builder = HTTP_CLIENT
        .get(&real_url)
        .header("Referer", BILIBILI_REFERER)
        .header("Origin", BILIBILI_ORIGIN)
        .header("User-Agent", BILIBILI_UA)
        .header("Range", &chunk_range_header);
    if !cookie_str.is_empty() {
        builder = builder.header("Cookie", cookie_str);
    }
    let resp = match builder.send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[audio_proxy] prefetch failed chunk={}: {}", chunk_index, e);
            return;
        }
    };
    let status = resp.status().as_u16();
    if status != 206 && status != 200 {
        eprintln!(
            "[audio_proxy] prefetch chunk={} bad status {}",
            chunk_index, status
        );
        return;
    }
    let upstream_headers = resp.headers().clone();
    let body = match resp.bytes().await {
        Ok(b) => b.to_vec(),
        Err(_) => return,
    };
    let total_size = upstream_headers
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .and_then(parse_total_from_content_range);
    let content_type = upstream_headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("audio/mp4")
        .to_string();
    if let (Some(total), Some(cs)) = (total_size, cache_state_opt.as_ref()) {
        if let Err(e) =
            audio_cache::store(cs.inner(), &cache_key, &body, total, &content_type).await
        {
            eprintln!("[audio_cache] prefetch store failed: {}", e);
        } else {
            eprintln!(
                "[audio_proxy] prefetch chunk={} ok ({} bytes)",
                chunk_index,
                body.len()
            );
        }
    }
}

/// 从已加载/缓存的 chunk 字节中切片，构造 206 响应给 audio 标签
fn build_slice_response(
    chunk_bytes: &[u8],
    chunk_start: u64,
    audio_start: u64,
    audio_end_opt: Option<u64>,
    chunk_end_inclusive: u64,
    total_size: u64,
    content_type: &str,
) -> tauri::http::Response<Vec<u8>> {
    let chunk_actual_last = chunk_start + chunk_bytes.len() as u64 - 1;
    // audio 想要的结束位置（不超过实际拿到的 chunk 末尾）
    let actual_end = match audio_end_opt {
        Some(e) => e.min(chunk_end_inclusive).min(chunk_actual_last),
        None => chunk_actual_last,
    };
    if audio_start > chunk_actual_last {
        return error_response(416, "Range Not Satisfiable");
    }
    let offset_in_chunk = (audio_start - chunk_start) as usize;
    let len = (actual_end - audio_start + 1) as usize;
    let slice = chunk_bytes[offset_in_chunk..offset_in_chunk + len].to_vec();
    let content_range = format!("bytes {}-{}/{}", audio_start, actual_end, total_size);
    tauri::http::Response::builder()
        .status(206)
        .header("content-type", content_type)
        .header("content-length", slice.len().to_string())
        .header("accept-ranges", "bytes")
        .header("content-range", content_range)
        .body(slice)
        .unwrap_or_else(|_| error_response(500, "build slice resp failed"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_target_url_from_query() {
        // 手动 URL-encode 避免引入额外 crate；与前端 transformer 的 encodeURIComponent 输出一致
        let req = "bili-stream://localhost/?url=https%3A%2F%2Fupos-sz-mirrorcos.bilivideo.com%2Ffoo.m4s%3Fe%3Dxxx";
        let real = "https://upos-sz-mirrorcos.bilivideo.com/foo.m4s?e=xxx";
        assert_eq!(extract_target_url(req).unwrap(), real);
    }

    #[test]
    fn extract_target_url_missing_query_returns_err() {
        let req = "bili-stream://localhost/";
        assert!(extract_target_url(req).is_err());
    }

    #[test]
    fn extract_target_url_empty_query_returns_err() {
        let req = "bili-stream://localhost/?url=";
        assert!(extract_target_url(req).is_err());
    }

    #[test]
    fn extract_target_url_invalid_uri_returns_err() {
        assert!(extract_target_url("not-a-uri").is_err());
    }

    #[test]
    fn is_allowed_host_bilivideo_suffix() {
        assert!(is_allowed_host(
            "https://upos-sz-mirrorcos.bilivideo.com/foo.m4s"
        ));
        assert!(is_allowed_host("https://cn-shanghai.bilivideo.com/x"));
    }

    #[test]
    fn is_allowed_host_akamaized_suffix() {
        assert!(is_allowed_host("https://x.mcdn.akamaized.net/y"));
    }

    #[test]
    fn is_allowed_host_hdslb_suffix() {
        assert!(is_allowed_host("https://i0.hdslb.com/cover.jpg"));
    }

    #[test]
    fn is_allowed_host_upos_prefix() {
        assert!(is_allowed_host("https://upos-anything.example.com/x"));
    }

    #[test]
    fn is_allowed_host_rejects_unknown_domain() {
        assert!(!is_allowed_host("https://example.com/x"));
        assert!(!is_allowed_host("https://api.bilibili.com/x"));
    }

    #[test]
    fn is_allowed_host_rejects_invalid_url() {
        assert!(!is_allowed_host("not-a-url"));
    }

    #[test]
    fn is_allowed_host_case_insensitive() {
        assert!(is_allowed_host("https://UPOS-XX.BILIVIDEO.COM/x"));
    }

    #[test]
    fn parse_range_full_form() {
        assert_eq!(parse_range(Some("bytes=0-1048575")), Some((0, Some(1048575))));
        assert_eq!(parse_range(Some("bytes=1048576-2097151")), Some((1048576, Some(2097151))));
    }

    #[test]
    fn parse_range_open_end() {
        assert_eq!(parse_range(Some("bytes=0-")), Some((0, None)));
        assert_eq!(parse_range(Some("bytes=512-")), Some((512, None)));
    }

    #[test]
    fn parse_range_with_whitespace_after_prefix() {
        // 部分客户端会写 "bytes= 0-1"
        assert_eq!(parse_range(Some("bytes= 0-1")), Some((0, Some(1))));
    }

    #[test]
    fn parse_range_handles_missing_or_invalid() {
        assert_eq!(parse_range(None), None);
        assert_eq!(parse_range(Some("invalid")), None);
        assert_eq!(parse_range(Some("bytes=abc-def")), None);
    }

    #[test]
    fn parse_total_from_content_range_works() {
        assert_eq!(
            parse_total_from_content_range("bytes 0-1048575/5242880"),
            Some(5242880)
        );
        assert_eq!(
            parse_total_from_content_range("bytes 0-1/100"),
            Some(100)
        );
    }

    #[test]
    fn parse_total_from_content_range_invalid() {
        assert_eq!(parse_total_from_content_range("bytes 0-1"), None);
        assert_eq!(parse_total_from_content_range("invalid"), None);
        assert_eq!(parse_total_from_content_range("bytes 0-1/*"), None);
    }

    #[test]
    fn chunk_bounds_first_chunk() {
        let (idx, start, end) = chunk_bounds(0);
        assert_eq!(idx, 0);
        assert_eq!(start, 0);
        assert_eq!(end, MAX_CHUNK_BYTES - 1);
    }

    #[test]
    fn chunk_bounds_within_first_chunk() {
        let (idx, start, end) = chunk_bounds(692);
        assert_eq!(idx, 0);
        assert_eq!(start, 0);
        assert_eq!(end, MAX_CHUNK_BYTES - 1);
    }

    #[test]
    fn chunk_bounds_second_chunk() {
        let (idx, start, end) = chunk_bounds(MAX_CHUNK_BYTES);
        assert_eq!(idx, 1);
        assert_eq!(start, MAX_CHUNK_BYTES);
        assert_eq!(end, 2 * MAX_CHUNK_BYTES - 1);
    }

    #[test]
    fn chunk_bounds_audio_atom_probe_within_first_4mb_chunk() {
        // 模拟 audio 在 m4s 中段探测：bytes=2674671-2674678
        // 4MB chunk 下都落在 chunk 0（0..=4194303）
        let (idx, start, end) = chunk_bounds(2674671);
        assert_eq!(idx, 0);
        assert_eq!(start, 0);
        assert_eq!(end, MAX_CHUNK_BYTES - 1);
    }

    #[test]
    fn chunk_bounds_audio_atom_probe_in_second_4mb_chunk() {
        // 4194304 (4MB) 进入第 1 chunk
        let (idx, start, end) = chunk_bounds(MAX_CHUNK_BYTES);
        assert_eq!(idx, 1);
        assert_eq!(start, MAX_CHUNK_BYTES);
        assert_eq!(end, 2 * MAX_CHUNK_BYTES - 1);
    }
}
