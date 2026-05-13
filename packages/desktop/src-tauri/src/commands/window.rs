use tauri::{AppHandle, Manager, Theme};

/// 设置主窗口的原生外观主题（macOS NSAppearance / Windows immersive dark mode）。
///
/// 必要性：Tauri v2 的 `WebviewWindow.setTheme()` JS 端 API 在 macOS 上是 NOOP，
/// 仅影响 webview 的 prefers-color-scheme。要同步改变 macOS 系统标题栏文字色
/// （在 `titleBarStyle: "Overlay"` 模式下尤其关键），必须在 Rust 端调用
/// `Window::set_theme()`，由 Tauri 内部走 NSWindow.appearance API。
///
/// 入参：
/// - "light" → 强制亮色
/// - "dark"  → 强制暗色
/// - 其他（含 "auto" / 空字符串）→ 跟随系统偏好（传 None）
#[tauri::command]
pub fn set_window_theme(app: AppHandle, theme: Option<String>) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("主窗口未找到")?;
    let theme_enum = match theme.as_deref() {
        Some("light") => Some(Theme::Light),
        Some("dark") => Some(Theme::Dark),
        _ => None,
    };
    window
        .set_theme(theme_enum)
        .map_err(|e| format!("set_theme 失败：{}", e))
}
