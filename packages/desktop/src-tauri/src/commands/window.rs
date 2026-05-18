use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use tauri::{AppHandle, Manager, State, Theme};

/// 主窗口关闭按钮的处置方式。
///
/// 与 `packages/shared/src/types/playlist.ts` 的 `CloseAction` 枚举对齐：
/// - `Exit` ↔ "exit"：放行默认关闭事件，触发应用退出
/// - `MinimizeToTray` ↔ "minimize-to-tray"：拦截 CloseRequested 并隐藏主窗口
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CloseAction {
    Exit,
    MinimizeToTray,
}

impl CloseAction {
    fn from_str(s: &str) -> Option<Self> {
        match s {
            "exit" => Some(Self::Exit),
            "minimize-to-tray" => Some(Self::MinimizeToTray),
            _ => None,
        }
    }
}

/// 当前生效的关闭行为，由前端 `set_close_action` 命令同步写入。
///
/// 默认 `MinimizeToTray`：保守策略——前端 hydrate 完成前若发生 CloseRequested，
/// 隐藏比退出安全（用户至少能从托盘恢复，不会出现"进程消失但引导对话框还在等输入"的死锁）。
pub struct CloseActionState(pub Mutex<CloseAction>);

impl Default for CloseActionState {
    fn default() -> Self {
        Self(Mutex::new(CloseAction::MinimizeToTray))
    }
}

/// 进程级"准备退出"标志位。
///
/// 由托盘菜单"退出"或 `RunEvent::ExitRequested` 监听器置位；
/// `WindowEvent::CloseRequested` handler 读取此标志，若为 true 则放行默认关闭，
/// 避免"prevent_close + app.exit 互相递归"导致的退出死循环。
pub struct IsQuittingState(pub AtomicBool);

impl Default for IsQuittingState {
    fn default() -> Self {
        Self(AtomicBool::new(false))
    }
}

impl IsQuittingState {
    pub fn mark_quitting(&self) {
        self.0.store(true, Ordering::Release);
    }

    pub fn is_quitting(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

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

/// 同步前端 `PlayerProfile.closeAction` 字段到 Rust state。
///
/// 调用时机由前端 `close-action-sync.ts` 决定：启动后调一次 + 字段变化时重发。
/// 非法 action 字符串直接返回 Err 而不静默成默认值，便于排查前后端类型漂移。
#[tauri::command]
pub fn set_close_action(state: State<'_, CloseActionState>, action: String) -> Result<(), String> {
    let parsed = CloseAction::from_str(&action)
        .ok_or_else(|| format!("无效的 close action：{}", action))?;
    let mut guard = state
        .0
        .lock()
        .map_err(|e| format!("CloseActionState 锁中毒：{}", e))?;
    *guard = parsed;
    Ok(())
}
