// B 站音频 / 视频流代理（custom URI scheme: bili-stream://）
//
// 背景：Tauri WebView 内 audio 标签 / img 等浏览器原生 fetch 受同源 + 反盗链限制，
// 直连 *.bilivideo.com 等域会被 B 站 403。axios 已用 plugin-http adapter 解决，
// 但 audio 标签前端无法注入 headers，必须由 Rust 后端代理转发。
//
// 协议格式：bili-stream://localhost/?url=ENCODED_REAL_URL
// 流程：解码 url → 域名白名单校验 → reqwest 注入 Referer/Origin/UA/Cookie + 透传 Range
// → 转发响应 (status/Content-Type/Content-Length/Accept-Ranges/Content-Range)。

use tauri::Manager;

use crate::commands::auth::CookieState;

const BILIBILI_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const BILIBILI_REFERER: &str = "https://www.bilibili.com/";
const BILIBILI_ORIGIN: &str = "https://www.bilibili.com";

// 与前端 transformBilibiliAudioUrl 的白名单同步；新增域必须双端同步
const ALLOWED_HOST_SUFFIXES: &[&str] = &[".bilivideo.com", ".akamaized.net", ".hdslb.com"];
const ALLOWED_HOST_PREFIXES: &[&str] = &["upos-"];

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

/// custom URI scheme handler：异步代理 B 站音频 / 视频流
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
    eprintln!(
        "[audio_proxy] handler invoked: uri={} range={:?}",
        req_uri, range_header
    );

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

        // Cookie 拼接（与 get_bilibili_cookies 同套逻辑）
        // 先 clone Vec<CookieRecord> 出来，避免 lock guard 借用 state 跨越后续语句导致
        // borrow checker 报"state does not live long enough"
        let cookies_snapshot: Vec<crate::commands::auth::CookieRecord> = {
            let state = app.state::<CookieState>();
            state
                .0
                .lock()
                .map(|g| g.clone())
                .unwrap_or_default()
        };
        let cookie_str = cookies_snapshot
            .iter()
            .map(|c| format!("{}={}", c.name, c.value))
            .collect::<Vec<_>>()
            .join("; ");

        let client = reqwest::Client::new();
        let mut builder = client
            .get(&real_url)
            .header("Referer", BILIBILI_REFERER)
            .header("Origin", BILIBILI_ORIGIN)
            .header("User-Agent", BILIBILI_UA);
        if !cookie_str.is_empty() {
            builder = builder.header("Cookie", cookie_str);
        }
        if let Some(r) = range_header {
            builder = builder.header("Range", r);
        }

        match builder.send().await {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let upstream_headers = resp.headers().clone();
                let body = resp.bytes().await.unwrap_or_default().to_vec();
                eprintln!(
                    "[audio_proxy] upstream resp: status={} body_len={} content-type={:?} content-range={:?}",
                    status,
                    body.len(),
                    upstream_headers.get("content-type").and_then(|v| v.to_str().ok()),
                    upstream_headers.get("content-range").and_then(|v| v.to_str().ok()),
                );
                let mut rb = tauri::http::Response::builder().status(status);
                // 仅透传必要的响应头：避免上游的 cookie / set-cookie 等导致 webview 行为异常
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
                let resp = match rb.body(body) {
                    Ok(r) => r,
                    Err(e) => {
                        eprintln!("[audio_proxy] build response failed: {}", e);
                        error_response(500, "build response failed")
                    }
                };
                responder.respond(resp);
            }
            Err(e) => {
                eprintln!("[audio_proxy] reqwest send failed: {}", e);
                responder.respond(error_response(502, &e.to_string()));
            }
        }
    });
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
}
