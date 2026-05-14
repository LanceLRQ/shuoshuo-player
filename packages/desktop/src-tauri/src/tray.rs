// 系统托盘集成（跨平台落点：Windows 任务栏 / macOS 菜单栏 status item / Linux 通知区）
//
// 行为：
// - 托盘菜单：显示窗口 / 退出
// - 左键单击托盘 → 显示并 focus 主窗口（macOS 习惯：左键打开菜单，但仍兼容显示窗口）
// - 用户从主窗口关闭 → 由 lib.rs 中 main window 的 on_window_event 拦截，按
//   PlayerProfile.closeAction 决定隐藏或退出；本模块只负责"退出"菜单这条手动 quit 路径

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

use crate::commands::window::IsQuittingState;

const TRAY_ID: &str = "main-tray";
const MENU_ID_SHOW: &str = "show";
const MENU_ID_QUIT: &str = "quit";

/// 在应用启动时创建托盘图标
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, MENU_ID_SHOW, "显示窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, MENU_ID_QUIT, "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    // 直接复用 bundle.icon 中的播放器主图标。Tauri 在 setup() 阶段已加载好，
    // 缺图标说明 tauri.conf.json bundle.icon 配置缺失，应该让 setup 显式失败。
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("default_window_icon".into()))?;

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon(icon)
        .on_menu_event(|app, event| match event.id.as_ref() {
            MENU_ID_SHOW => show_main_window(app),
            MENU_ID_QUIT => {
                // 关键：先置 is_quitting，再 app.exit()。否则主窗口 CloseRequested
                // 在 minimize-to-tray 模式下会 prevent_close，让 exit 永远走不到收尾。
                app.state::<IsQuittingState>().mark_quitting();
                app.exit(0);
            }
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
