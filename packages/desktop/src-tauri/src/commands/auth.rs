// B 站登录/登出命令
//
// 关键不变量（与 v1 main.js 对齐）：
// 1. 登录 URL 必须为 https://passport.bilibili.com/pc/passport/login
//    （/login 在某些客户端 UA 下会跳到受限的扫码页）
// 2. 导航拦截：登录窗口检测到 *.bilibili.com 主域 → 关闭窗口 + emit bilibili:login_success
// 3. Cookie 持久化前剥离 session=false 标记，否则关闭应用后 cookie 丢失
// 4. 登出后清除 CookieState + 关主窗 + 重新弹登录窗口（v1 行为）
//
// CookieState 当前以 in-memory + tauri-plugin-store 文件 bilibili_cookies.json 落地，
// 落盘前对 cookie 列表做 XOR 流混淆（详见本文件 obfuscate_cookies）；
// reqwest cookie store 共享将在 spider 命令实装时统一接通（批 4）。

use base64::Engine;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

const BILIBILI_LOGIN_URL: &str = "https://passport.bilibili.com/pc/passport/login";
const COOKIES_STORE_FILE_NAME: &str = "bilibili_cookies.json";
const COOKIES_STORE_KEY: &str = "cookies";

/// cookie 混淆格式版本前缀（bilibili player cookie v1）。
/// restore 时凭 JSON 值类型 + 此前缀区分新混淆串与 v2 早期明文数组。
const COOKIES_OBFUSCATE_PREFIX: &str = "BPC1:";

/// 固定 32B 混淆 key。
///
/// 不绑机器（区别于 audio_cache 的 machine-uid 派生 key），以保证 portable 模式下
/// data 目录连同混淆文件拷到另一台机器仍可解。安全立场同 audio_cache：仅做"防肉眼 /
/// 防文本扫描"的误识别防护，不是真加密——开源 + 本地应用密钥无处安放，加密拦不住逆向。
const COOKIES_OBFUSCATE_KEY: [u8; 32] = [
    0x3a, 0x9f, 0x71, 0xc4, 0x18, 0xe6, 0x5d, 0x2b, 0x84, 0xf0, 0x6c, 0x39, 0xa7, 0x1e, 0xd2, 0x58,
    0x0b, 0x95, 0x4f, 0xe3, 0x77, 0x2c, 0xb8, 0x61, 0xda, 0x07, 0x93, 0x4e, 0xc1, 0x35, 0xa9, 0x6f,
];

/// portable 模式：返回 <exe_dir>/data/bilibili_cookies.json 绝对路径；
/// 非 portable 模式：返回相对名（plugin-store 走 app_data_dir）
fn cookies_store_path() -> String {
    match crate::portable::try_data_root() {
        Some(root) => root
            .join(COOKIES_STORE_FILE_NAME)
            .to_string_lossy()
            .into_owned(),
        None => COOKIES_STORE_FILE_NAME.to_string(),
    }
}
const LOGIN_WINDOW_LABEL: &str = "bilibili-login";
const MAIN_WINDOW_LABEL: &str = "main";

/// 单条 cookie 的可持久化形态（剥离 session 标记后用于落盘）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct CookieRecord {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    /// 持久化前永远写为 false，避免 WebView 关闭后丢失（v1 行为）
    #[serde(default)]
    pub session: bool,
}

/// 剥离 cookie 的 session 标记
///
/// v1 main.js 第 38-54 行的等价行为：所有进入持久化层的 cookie，session 字段必须为 false，
/// 否则 WebView 关闭后会被 GC 掉。此函数对单条记录就地修改。
pub fn strip_session(cookie: &mut CookieRecord) {
    cookie.session = false;
}

/// 批量剥离一组 cookie 的 session 标记
pub fn strip_sessions(cookies: &mut [CookieRecord]) {
    for c in cookies.iter_mut() {
        strip_session(c);
    }
}

/// 就地 XOR：32B key 循环 + 位置混入（`^ i as u8`），让 SESSDATA 这类长字符串
/// 不暴露 32 字节周期的重复 pattern。XOR 无 padding 且对称，混淆与解混是同一运算。
fn xor_cookies_in_place(buf: &mut [u8]) {
    for (i, b) in buf.iter_mut().enumerate() {
        *b ^= COOKIES_OBFUSCATE_KEY[i & 0x1F] ^ (i as u8);
    }
}

/// cookie 列表 → 带版本前缀的混淆 base64 字符串
fn obfuscate_cookies(cookies: &[CookieRecord]) -> Result<String, String> {
    let mut bytes = serde_json::to_vec(cookies).map_err(|e| e.to_string())?;
    xor_cookies_in_place(&mut bytes);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("{COOKIES_OBFUSCATE_PREFIX}{encoded}"))
}

/// 带版本前缀的混淆字符串 → cookie 列表（仅处理新混淆格式）
fn deobfuscate_cookies(s: &str) -> Result<Vec<CookieRecord>, String> {
    let encoded = s
        .strip_prefix(COOKIES_OBFUSCATE_PREFIX)
        .ok_or_else(|| "cookie 混淆前缀缺失".to_string())?;
    let mut bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| e.to_string())?;
    xor_cookies_in_place(&mut bytes);
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

/// 解析 store 中持久化的 cookie 值，兼容两种磁盘格式。
///
/// 返回的 `bool` 为 true 表示命中 v2 早期明文数组（legacy），由调用方负责立即覆写迁移，
/// 消除磁盘上残留的明文 SESSDATA。
/// - JSON String（`"BPC1:..."`）→ 新混淆格式，false
/// - JSON Array → v2 早期明文数组，true
fn parse_stored_cookies(raw: serde_json::Value) -> Result<(Vec<CookieRecord>, bool), String> {
    match raw {
        serde_json::Value::String(s) => Ok((deobfuscate_cookies(&s)?, false)),
        other => {
            let cookies = serde_json::from_value(other).map_err(|e| e.to_string())?;
            Ok((cookies, true))
        }
    }
}

/// 运行时 cookie 缓存（启动时从 bilibili_cookies.json 回放）
#[derive(Default)]
pub struct CookieState(pub Mutex<Vec<CookieRecord>>);

/// 把 CookieState 当前内容剥离 session、XOR 混淆后写入 bilibili_cookies.json
pub fn persist_cookies<R: Runtime>(
    app: &AppHandle<R>,
    state: &CookieState,
) -> Result<(), String> {
    let mut cookies = state.0.lock().map_err(|e| e.to_string())?.clone();
    strip_sessions(&mut cookies);

    let store = app.store(cookies_store_path()).map_err(|e| e.to_string())?;
    store.set(COOKIES_STORE_KEY.to_string(), obfuscate_cookies(&cookies)?);
    store.save().map_err(|e| e.to_string())
}

/// 从 bilibili_cookies.json 回放到 CookieState（应用启动时调用）。
/// 兼容读取 v2 早期明文数组格式，命中时立即覆写为混淆格式完成迁移。
pub fn restore_cookies<R: Runtime>(
    app: &AppHandle<R>,
    state: &CookieState,
) -> Result<(), String> {
    let store = app.store(cookies_store_path()).map_err(|e| e.to_string())?;
    let raw = match store.get(COOKIES_STORE_KEY) {
        Some(v) => v,
        None => return Ok(()),
    };
    let (cookies, is_legacy_plaintext) = parse_stored_cookies(raw)?;
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        *guard = cookies;
    }
    // 命中 v2 早期明文格式 → 立即覆写为混淆格式，消除磁盘上残留的明文 SESSDATA
    if is_legacy_plaintext {
        persist_cookies(app, state).ok();
    }
    Ok(())
}

/// 打开 B 站登录窗口
///
/// - 已存在登录窗口 → set_focus
/// - 不存在 → 1000x640 不可缩放窗口，导航到 BILIBILI_LOGIN_URL
/// - 导航到 *.bilibili.com 主域 → 视为登录成功，关闭窗口 + emit bilibili:login_success
#[tauri::command]
pub async fn bilibili_login<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        existing.set_focus().ok();
        return Ok(());
    }

    let app_for_nav = app.clone();
    let url = BILIBILI_LOGIN_URL.parse().map_err(|e: url::ParseError| e.to_string())?;

    WebviewWindowBuilder::new(&app, LOGIN_WINDOW_LABEL, WebviewUrl::External(url))
        .title("B 站登录")
        .inner_size(1000.0, 640.0)
        .resizable(false)
        .on_navigation(move |url| {
            // 诊断：每次 navigation 都打印目标 URL，帮助排查跳转目标分支
            eprintln!("[auth] on_navigation: {}", url);
            // 命中条件放宽：除 passport.bilibili.com 外的 *.bilibili.com 都视为登录成功跳出。
            // B 站登录后实际可能跳转到 www / m / space / live 等子域，原硬编码 www
            // 在 macOS WKWebView 下偶尔不命中（passport 内 JS replace 跳转）。
            let host = url.host_str().unwrap_or("");
            let is_bilibili = host.ends_with(".bilibili.com") || host == "bilibili.com";
            let is_passport = host == "passport.bilibili.com";
            if is_bilibili && !is_passport {
                eprintln!("[auth] login success detected, host={}", host);
                let app_emit = app_for_nav.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(win) = app_emit.get_webview_window(LOGIN_WINDOW_LABEL) {
                        // 提取 webview cookie（含 HttpOnly 的 SESSDATA）→ CookieState → persist
                        // 这是绕开浏览器 CORS 限制后，主窗口 axios 请求注入 Cookie header
                        // 的数据源。详见 tauri-bilibili-http-adapter.ts。
                        match win.cookies() {
                            Ok(cookies) => {
                                let total = cookies.len();
                                let records: Vec<CookieRecord> = cookies
                                    .iter()
                                    .filter(|c| {
                                        c.domain()
                                            .map(|d| d.contains("bilibili.com"))
                                            .unwrap_or(false)
                                    })
                                    .map(|c| CookieRecord {
                                        name: c.name().to_string(),
                                        value: c.value().to_string(),
                                        domain: c.domain().map(String::from),
                                        path: c.path().map(String::from),
                                        session: false,
                                    })
                                    .collect();
                                eprintln!(
                                    "[auth] cookies extracted: total={}, bilibili_filtered={}, names={:?}",
                                    total,
                                    records.len(),
                                    records.iter().map(|c| &c.name).collect::<Vec<_>>()
                                );
                                let cookie_state = app_emit.state::<CookieState>();
                                if let Ok(mut guard) = cookie_state.0.lock() {
                                    *guard = records;
                                }
                                if let Err(e) = persist_cookies(&app_emit, &cookie_state) {
                                    eprintln!("[auth] persist_cookies failed: {}", e);
                                } else {
                                    eprintln!("[auth] persist_cookies ok");
                                }
                            }
                            Err(e) => {
                                eprintln!("[auth] cookies() failed: {}", e);
                            }
                        }
                        win.close().ok();
                    }
                    app_emit.emit("bilibili:login_success", ()).ok();
                    eprintln!("[auth] emitted bilibili:login_success");
                });
                return false;
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 取出当前 CookieState 序列化为 HTTP Cookie header 形态（"k1=v1; k2=v2"）
///
/// 由前端 TauriBilibiliHttpAdapter 在每次请求 B 站 API 前调用，注入到 Cookie header。
/// 因为 reqwest（plugin-http 底层）的 cookie store 与 webview cookie store 是隔离的，
/// 必须由 Rust 端在 axios 请求前显式拼接注入。
#[tauri::command]
pub async fn get_bilibili_cookies(
    state: tauri::State<'_, CookieState>,
) -> Result<String, String> {
    let cookies = state.0.lock().map_err(|e| e.to_string())?;
    Ok(cookies
        .iter()
        .map(|c| format!("{}={}", c.name, c.value))
        .collect::<Vec<_>>()
        .join("; "))
}

/// 退出 B 站登录
///
/// - 清空 CookieState（in-memory + 持久化）
/// - 清空所有打开窗口的 WebView 浏览数据（cookies / localStorage / cache）
///   ⚠️ 关键：CookieState 仅用于 axios/reqwest 应用层注入，WebView 自身有独立的
///   cookie store（WKWebView 的 WKHTTPCookieStore / WebView2 的 CoreWebView2CookieManager），
///   不清这一层登录窗口重新打开时 SESSDATA 仍在 → 自动登录
/// - 关闭主窗口
/// - emit bilibili:logout_success
/// - 自动重新打开登录窗口（v1 行为）
#[tauri::command]
pub async fn bilibili_logout<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let cookie_state = app.state::<CookieState>();
    {
        let mut cookies = cookie_state.0.lock().map_err(|e| e.to_string())?;
        cookies.clear();
    }
    persist_cookies(&app, &cookie_state).ok();

    // 遍历所有 webview 窗口清浏览数据；macOS WKWebView 共享 dataStore（任一调用全局生效），
    // Windows WebView2 每个窗口可能有独立 profile，逐个清更稳
    for (label, win) in app.webview_windows() {
        if let Err(e) = win.clear_all_browsing_data() {
            eprintln!("[auth] clear_all_browsing_data window={} failed: {}", label, e);
        } else {
            eprintln!("[auth] clear_all_browsing_data window={} ok", label);
        }
    }

    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        main_window.close().ok();
    }
    app.emit("bilibili:logout_success", ()).map_err(|e| e.to_string())?;

    bilibili_login(app).await
}

#[cfg(test)]
mod tests {
    use super::{
        deobfuscate_cookies, obfuscate_cookies, parse_stored_cookies, strip_session,
        strip_sessions, CookieRecord, COOKIES_OBFUSCATE_PREFIX,
    };

    fn rec(name: &str, session: bool) -> CookieRecord {
        CookieRecord {
            name: name.into(),
            value: "v".into(),
            domain: Some(".bilibili.com".into()),
            path: Some("/".into()),
            session,
        }
    }

    #[test]
    fn strip_session_sets_false() {
        let mut c = rec("SESSDATA", true);
        strip_session(&mut c);
        assert!(!c.session);
    }

    #[test]
    fn strip_session_idempotent_when_already_false() {
        let mut c = rec("buvid3", false);
        strip_session(&mut c);
        assert!(!c.session);
    }

    #[test]
    fn strip_sessions_processes_all() {
        let mut cookies = vec![rec("SESSDATA", true), rec("buvid3", true), rec("DedeUserID", false)];
        strip_sessions(&mut cookies);
        assert!(cookies.iter().all(|c| !c.session));
    }

    #[test]
    fn cookie_record_serde_roundtrip() {
        let c = rec("SESSDATA", false);
        let json = serde_json::to_string(&c).unwrap();
        let back: CookieRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(c, back);
    }

    #[test]
    fn cookie_record_deserialize_missing_session_defaults_false() {
        let json = r#"{"name":"x","value":"y","domain":null,"path":null}"#;
        let parsed: CookieRecord = serde_json::from_str(json).unwrap();
        assert!(!parsed.session);
    }

    #[test]
    fn obfuscate_deobfuscate_roundtrip() {
        let cookies = vec![rec("SESSDATA", false), rec("buvid3", false)];
        let blob = obfuscate_cookies(&cookies).unwrap();
        let back = deobfuscate_cookies(&blob).unwrap();
        assert_eq!(cookies, back);
    }

    #[test]
    fn obfuscated_blob_hides_plaintext() {
        let mut c = rec("SESSDATA", false);
        c.value = "super-secret-token-value".into();
        let blob = obfuscate_cookies(std::slice::from_ref(&c)).unwrap();
        assert!(blob.starts_with(COOKIES_OBFUSCATE_PREFIX));
        // 混淆串里不得出现明文 token 值与字段名
        assert!(!blob.contains("super-secret-token-value"));
        assert!(!blob.contains("SESSDATA"));
    }

    #[test]
    fn deobfuscate_rejects_missing_prefix() {
        // 无版本前缀的字符串应被拒绝，而非误解码
        assert!(deobfuscate_cookies("not-a-valid-blob").is_err());
    }

    #[test]
    fn parse_stored_new_format_string() {
        let cookies = vec![rec("SESSDATA", false)];
        let blob = obfuscate_cookies(&cookies).unwrap();
        let (parsed, is_legacy) = parse_stored_cookies(serde_json::Value::String(blob)).unwrap();
        assert_eq!(parsed, cookies);
        assert!(!is_legacy);
    }

    #[test]
    fn parse_stored_legacy_plaintext_array() {
        // v2 早期明文数组应被识别为 legacy，触发迁移覆写
        let cookies = vec![rec("SESSDATA", false), rec("DedeUserID", false)];
        let raw = serde_json::to_value(&cookies).unwrap();
        let (parsed, is_legacy) = parse_stored_cookies(raw).unwrap();
        assert_eq!(parsed, cookies);
        assert!(is_legacy);
    }
}
