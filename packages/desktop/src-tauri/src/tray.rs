// 系统托盘集成
//
// 行为（与 v1 main.js + 桌面端常见模式对齐）：
// - 托盘菜单：显示窗口 / 退出
// - 左键单击托盘 → 显示并 focus 主窗口（macOS 习惯：左键打开菜单，但仍兼容显示窗口）
// - 用户从主窗口关闭 → 不退出应用，仅隐藏到托盘（由 Window::on_window_event 处理，留 Phase 7 联调时接入）

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

const TRAY_ID: &str = "main-tray";
const MENU_ID_SHOW: &str = "show";
const MENU_ID_QUIT: &str = "quit";

/// 在应用启动时创建托盘图标
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, MENU_ID_SHOW, "显示窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, MENU_ID_QUIT, "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon(app.default_window_icon().cloned().unwrap_or_else(|| {
            // 兜底：fallback 不应触发——bundle.icon 列表已包含主图标
            tauri::image::Image::new_owned(vec![0u8; 4], 1, 1)
        }))
        .on_menu_event(|app, event| match event.id.as_ref() {
            MENU_ID_SHOW => show_main_window(app),
            MENU_ID_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // 左键单击 → 显示主窗口（macOS 习惯仍兼容此行为以便键鼠用户使用）
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        window.show().ok();
        window.set_focus().ok();
        window.unminimize().ok();
    }
}
