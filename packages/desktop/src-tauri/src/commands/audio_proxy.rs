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
/// 16 MB 的权衡（针对常见 5 分钟以内音频，192K ~ 320K Dolby 单 chunk 全覆盖）：
/// - 192K 5min ≈ 7MB / 320K Dolby 5min ≈ 12MB → 大多数曲目 1 个 chunk 搞定
/// - HTTP 调用次数最小化：单首歌通常仅 1 次 reqwest，避免跨 chunk RTT
/// - mem_cache 4 条 × 16MB = 64 MB 内存上限（仍在合理范围）
/// - miss 时浪费的下载量从 4MB → 16MB；single-flight 防并发重复
/// - 慢速 50 KB/s 等 320s 才能吃下一段（早已不是主流网络场景）
///
/// ⚠️ 修改此值必须同步更新 compute_chunk_cache_key 的 chunk_size 入参，
/// 否则旧 cache 文件会被新读取路径切片越界。
const MAX_CHUNK_BYTES: u64 = 16 * 1024 * 1024;

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

/// 给响应 builder 注入 CORS 头：bili-stream:// 与 webview origin (http://localhost:1420 / tauri://localhost)
/// 是不同源，WKWebView 对 audio 标签 / fetch 都会做 CORS 检查；缺 ACAO 时 audio onloaderror=4
/// (MEDIA_ERR_SRC_NOT_SUPPORTED)。这里统一给所有响应路径补全。
///
/// Expose-Headers 暴露 Range 相关头给前端 JS（fetch 探测调试用），audio 标签本身不依赖。
fn with_cors_headers(
    builder: tauri::http::response::Builder,
) -> tauri::http::response::Builder {
    builder
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        .header(
            "Access-Control-Allow-Headers",
            "Range, Content-Type, Accept",
        )
        .header(
            "Access-Control-Expose-Headers",
            "Content-Range, Content-Length, Accept-Ranges, X-Upstream-Status, X-Upstream-Host",
        )
}

fn error_response(status: u16, message: &str) -> tauri::http::Response<Vec<u8>> {
    let builder = tauri::http::Response::builder()
        .status(status)
        .header("content-type", "text/plain; charset=utf-8");
    with_cors_headers(builder)
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
/// 核心策略：audio 标签会发大量碎片小 Range（mp4 atom 探测），但都落在
/// MAX_CHUNK_BYTES (16 MB) 边界内。handler 一次下载整段 chunk 缓存到本地，
/// 后续 audio 任意小 Range 都从 cache 切片返回，避免重复 reqwest 调用
/// （千兆带宽下 RTT 串行才是真正瓶颈）。
pub fn handle_audio_proxy<R: tauri::Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: tauri::http::Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    // CORS preflight：fetch / 部分 audio 实现遇到非 simple header 会先发 OPTIONS。
    // 直接 204 + CORS 头放行，避免落到下方 GET 处理路径浪费一次 reqwest
    if request.method() == tauri::http::Method::OPTIONS {
        let builder = tauri::http::Response::builder()
            .status(204)
            .header("content-length", "0");
        let resp = with_cors_headers(builder)
            .body(Vec::new())
            .unwrap_or_else(|_| error_response(500, "preflight build failed"));
        responder.respond(resp);
        return;
    }

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
        let cache_key = audio_cache::compute_chunk_cache_key(&real_url, chunk_index, MAX_CHUNK_BYTES);

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

        // 仅 chunk 0 / Range 起始打一行 cookie 注入摘要：cookie 名列表 + 总长度。
        // 后续 chunk 复用同一份 cookie 不再重复打日志（避免连续 16MB chunk 刷屏）
        if chunk_index == 0 {
            let cookie_names: Vec<&str> =
                cookies_snapshot.iter().map(|c| c.name.as_str()).collect();
            let host = url::Url::parse(&real_url)
                .ok()
                .and_then(|u| u.host_str().map(|s| s.to_string()))
                .unwrap_or_else(|| "<unknown>".into());
            eprintln!(
                "[audio_proxy] req host={} cookie_names={:?} cookie_total_len={}",
                host,
                cookie_names,
                cookie_str.len()
            );
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

                let upstream_content_type_raw = upstream_headers
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("audio/mp4")
                    .to_string();
                // B 站对部分老视频上游返回 application/octet-stream（非 audio/*），
                // WKWebView 在 custom URI scheme 路径下不做 MIME 嗅探，audio 标签按响应
                // content-type 直接拒收 → onloaderror=4 (MEDIA_ERR_SRC_NOT_SUPPORTED)。
                // bili-stream:// 只代理 dash audio m4s，统一规范为 audio/mp4 安全；
                // 上游已经是 audio/* 时透传，避免覆盖罕见的 audio/aac / audio/mpeg。
                let upstream_content_type =
                    if upstream_content_type_raw.starts_with("audio/") {
                        upstream_content_type_raw.clone()
                    } else {
                        "audio/mp4".to_string()
                    };
                let total_size_opt = upstream_headers
                    .get("content-range")
                    .and_then(|v| v.to_str().ok())
                    .and_then(parse_total_from_content_range);

                if chunk_index == 0 {
                    // chunk 0 打全量响应头摘要：诊断 audio 标签 onloaderror 用
                    let upstream_cr = upstream_headers
                        .get("content-range")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("<missing>");
                    let upstream_ar = upstream_headers
                        .get("accept-ranges")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("<missing>");
                    eprintln!(
                        "[audio_proxy] chunk=0 upstream ct_raw={:?} ct_final={:?} accept_ranges={:?} content_range={:?}",
                        upstream_content_type_raw, upstream_content_type, upstream_ar, upstream_cr
                    );
                }

                eprintln!(
                    "[audio_proxy] chunk={} status={} bytes={} elapsed={}ms speed={}KB/s",
                    chunk_index, status, chunk_body.len(), elapsed_ms, kb_per_s
                );

                // 上游错误：详细日志 + 直接转发原响应（不写缓存）
                if status != 206 && status != 200 {
                    // 提取 host / content-type 用于诊断（B 站对部分老视频高码率档可能 403/404）
                    let host = url::Url::parse(&real_url)
                        .ok()
                        .and_then(|u| u.host_str().map(|s| s.to_string()))
                        .unwrap_or_else(|| "<unknown>".into());
                    let upstream_ct = upstream_headers
                        .get("content-type")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("<missing>");
                    let body_preview = String::from_utf8_lossy(
                        &chunk_body[..chunk_body.len().min(512)],
                    )
                    .to_string();
                    eprintln!(
                        "[audio_proxy] UPSTREAM ERROR host={} status={} ct={} body_preview={}",
                        host, status, upstream_ct, body_preview
                    );

                    let mut rb = tauri::http::Response::builder().status(status);
                    for h in ["content-type", "content-length", "content-range"] {
                        if let Some(v) = upstream_headers.get(h) {
                            if let Ok(s) = v.to_str() {
                                rb = rb.header(h, s);
                            }
                        }
                    }
                    // 把上游 status / host 暴露到响应头：前端 fetch 探测能直接读到，无需查 Tauri 终端
                    rb = rb
                        .header("X-Upstream-Status", status.to_string())
                        .header("X-Upstream-Host", host);
                    let r = with_cors_headers(rb)
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
                        let r = with_cors_headers(rb)
                            .body(chunk_body)
                            .unwrap_or_else(|_| error_response(500, "build resp failed"));
                        responder.respond(r);
                        return;
                    }
                };

                // 1. 同步预热 mem_cache：保证 audio 标签后续在同一 chunk 的小 Range 探测
                //    立即命中（从内存切片返回），无需等磁盘落盘完成
                if let Some(cs) = cache_state_opt.as_ref() {
                    if let Ok(mut g) = cs.inner().mem_cache.lock() {
                        g.put(
                            cache_key.clone(),
                            std::sync::Arc::new(audio_cache::MemHitData {
                                bytes: chunk_body.clone(),
                                total_size,
                                content_type: upstream_content_type.clone(),
                            }),
                        );
                    }
                }

                // 2. 立即切片响应客户端（不再阻塞等加密 + fs::write + 索引）
                //    与同步路径相比首块延迟降低 ~60ms（10ms 加密 + 50ms 落盘均移到后台）
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

                // 3. 后台落盘 + 索引（fire-and-forget，失败仅日志）
                //    inflight_guard 在 handler async fut 结束时释放，不阻塞并发请求；
                //    并发请求拿锁后会从 mem_cache 同步命中（步骤 1 已写）
                {
                    let app_clone = app.clone();
                    let key_owned = cache_key.clone();
                    let body_owned = chunk_body; // move：respond 已 build slice，原 body 不再用
                    let ct_owned = upstream_content_type.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Some(cs) = app_clone.try_state::<AudioCacheState>() {
                            if let Err(e) = audio_cache::store(
                                cs.inner(),
                                &key_owned,
                                &body_owned,
                                total_size,
                                &ct_owned,
                            )
                            .await
                            {
                                eprintln!("[audio_cache] async store failed: {}", e);
                            }
                        }
                    });
                }

                // 4. 跨段预取：当前 chunk 下完后，后台预下下一个 chunk（如尚未到文件末尾且未缓存）
                //    与 handler miss 路径走相同 inflight 锁，避免并发重复
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
                let host = url::Url::parse(&real_url)
                    .ok()
                    .and_then(|u| u.host_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "<unknown>".into());
                eprintln!(
                    "[audio_proxy] reqwest send failed host={} chunk={} err={}",
                    host, chunk_index, e
                );
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
    let cache_key = audio_cache::compute_chunk_cache_key(&real_url, chunk_index, MAX_CHUNK_BYTES);

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
    // 规范化 content-type：旧版本（修复前）写入缓存的 application/octet-stream 仍可能命中，
    // 此处统一兜底为 audio/mp4，确保 audio 标签能识别（详见请求路径同名规范化逻辑注释）
    let normalized_ct = if content_type.starts_with("audio/") {
        content_type
    } else {
        "audio/mp4"
    };
    let builder = tauri::http::Response::builder()
        .status(206)
        .header("content-type", normalized_ct)
        .header("content-length", slice.len().to_string())
        .header("accept-ranges", "bytes")
        .header("content-range", content_range);
    with_cors_headers(builder)
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
    fn chunk_bounds_audio_atom_probe_within_first_chunk() {
        // 模拟 audio 在 m4s 中段探测：bytes=2674671-2674678 都落在 chunk 0
        let (idx, start, end) = chunk_bounds(2674671);
        assert_eq!(idx, 0);
        assert_eq!(start, 0);
        assert_eq!(end, MAX_CHUNK_BYTES - 1);
    }

    #[test]
    fn chunk_bounds_audio_atom_probe_in_second_chunk() {
        // 落到 MAX_CHUNK_BYTES 边界进入第 1 chunk
        let (idx, start, end) = chunk_bounds(MAX_CHUNK_BYTES);
        assert_eq!(idx, 1);
        assert_eq!(start, MAX_CHUNK_BYTES);
        assert_eq!(end, 2 * MAX_CHUNK_BYTES - 1);
    }
}
