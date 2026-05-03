// B 站登录/登出命令
//
// 关键不变量（与 v1 main.js 对齐）：
// 1. 登录 URL 必须为 https://passport.bilibili.com/pc/passport/login
//    （/login 在某些客户端 UA 下会跳到受限的扫码页）
// 2. 导航拦截：登录窗口检测到 *.bilibili.com 主域 → 关闭窗口 + emit bilibili:login_success
// 3. Cookie 持久化前剥离 session=false 标记，否则关闭应用后 cookie 丢失
// 4. 登出后清除 CookieState + 关主窗 + 重新弹登录窗口（v1 行为）
//
// CookieState 当前以 in-memory + tauri-plugin-store 文件 bilibili_cookies.json 落地；
// reqwest cookie store 共享将在 spider 命令实装时统一接通（批 4）。

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

const BILIBILI_LOGIN_URL: &str = "https://passport.bilibili.com/pc/passport/login";
const COOKIES_STORE_FILE: &str = "bilibili_cookies.json";
const COOKIES_STORE_KEY: &str = "cookies";
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

/// 运行时 cookie 缓存（启动时从 bilibili_cookies.json 回放）
#[derive(Default)]
pub struct CookieState(pub Mutex<Vec<CookieRecord>>);

/// 把 CookieState 当前内容剥离 session 后写入 bilibili_cookies.json
pub fn persist_cookies<R: Runtime>(
    app: &AppHandle<R>,
    state: &CookieState,
) -> Result<(), String> {
    let mut cookies = state.0.lock().map_err(|e| e.to_string())?.clone();
    strip_sessions(&mut cookies);

    let store = app.store(COOKIES_STORE_FILE).map_err(|e| e.to_string())?;
    store.set(
        COOKIES_STORE_KEY.to_string(),
        serde_json::to_value(&cookies).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}

/// 从 bilibili_cookies.json 回放到 CookieState（应用启动时调用）
pub fn restore_cookies<R: Runtime>(
    app: &AppHandle<R>,
    state: &CookieState,
) -> Result<(), String> {
    let store = app.store(COOKIES_STORE_FILE).map_err(|e| e.to_string())?;
    let raw = match store.get(COOKIES_STORE_KEY) {
        Some(v) => v,
        None => return Ok(()),
    };
    let cookies: Vec<CookieRecord> = serde_json::from_value(raw).map_err(|e| e.to_string())?;
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = cookies;
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
            if url.host_str() == Some("www.bilibili.com") {
                let app_emit = app_for_nav.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(win) = app_emit.get_webview_window(LOGIN_WINDOW_LABEL) {
                        win.close().ok();
                    }
                    app_emit.emit("bilibili:login_success", ()).ok();
                });
                return false;
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 退出 B 站登录
///
/// - 清空 CookieState（in-memory + 持久化）
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

    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        main_window.close().ok();
    }
    app.emit("bilibili:logout_success", ()).map_err(|e| e.to_string())?;

    bilibili_login(app).await
}

#[cfg(test)]
mod tests {
    use super::{strip_session, strip_sessions, CookieRecord};

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
}
