// 系统托盘集成（跨平台落点：Windows 任务栏 / macOS 菜单栏 status item / Linux 通知区）
//
// 菜单结构（基础播放控制档）：
//   1. 当前曲目标签（disabled，由前端 tray-sync 动态更新文案）
//   2. 分隔线
//   3. 播放/暂停（文案动态切换）
//   4. 上一首
//   5. 下一首
//   6. 分隔线
//   7. 显示主窗口
//   8. 设置…（先 show 主窗口再 emit 路由跳转）
//   9. 分隔线
//   10. 退出说说播放器（置 is_quitting flag 后 app.exit 0）
//
// 关闭按钮的处置（隐藏 / 退出）由 lib.rs 中 main window 的 on_window_event 拦截，
// 本模块只负责"退出"菜单这条手动 quit 路径与运行时菜单文案变更入口。

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

#[cfg(target_os = "macos")]
use tauri::image::Image;

use crate::commands::tray::TrayMenuState;
use crate::commands::window::IsQuittingState;

const TRAY_ID: &str = "main-tray";
const MENU_ID_TRACK: &str = "track-label";
const MENU_ID_PLAY_PAUSE: &str = "play-pause";
const MENU_ID_PREV: &str = "prev";
const MENU_ID_NEXT: &str = "next";
const MENU_ID_SHOW: &str = "show";
const MENU_ID_SETTINGS: &str = "settings";
const MENU_ID_QUIT: &str = "quit";

const EVENT_TRAY_COMMAND: &str = "tray:command";
const EVENT_OPEN_SETTINGS: &str = "tray:open-settings";

/// 在应用启动时创建托盘图标
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    // 顶部曲目标签：disabled（enabled=false）—— 用户不可点击但可见
    let track_item = MenuItem::with_id(app, MENU_ID_TRACK, "未在播放", false, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let play_pause_item = MenuItem::with_id(app, MENU_ID_PLAY_PAUSE, "播放", true, None::<&str>)?;
    let prev_item = MenuItem::with_id(app, MENU_ID_PREV, "上一首", true, None::<&str>)?;
    let next_item = MenuItem::with_id(app, MENU_ID_NEXT, "下一首", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let show_item = MenuItem::with_id(app, MENU_ID_SHOW, "显示主窗口", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, MENU_ID_SETTINGS, "设置…", true, None::<&str>)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, MENU_ID_QUIT, "退出说说播放器", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &track_item,
            &sep1,
            &play_pause_item,
            &prev_item,
            &next_item,
            &sep2,
            &show_item,
            &settings_item,
            &sep3,
            &quit_item,
        ],
    )?;

    // 把"动态文案"两项的句柄写入全局 state，让 invoke 命令能在运行时调 set_text()
    let tray_state = app.state::<TrayMenuState>();
    if let Ok(mut guard) = tray_state.track_item.lock() {
        *guard = Some(track_item);
    }
    if let Ok(mut guard) = tray_state.play_pause_item.lock() {
        *guard = Some(play_pause_item);
    }

    // 图标策略：
    // - macOS 用 tray-template.png（黑色 + alpha），配合 icon_as_template=true，
    //   系统按 menubar 主题自动反色（dark menubar 显示白色，light menubar 显示黑色）
    // - 其他平台用 bundle 主图标（彩色），Windows / Linux 托盘无 template 概念
    //
    // 同源借用问题：default_window_icon() 返回 `&Image<'_>`（借自 app），无法跨函数
    // 抽到 helper 返回 `Image<'static>`；改为分支内 inline 给 builder.icon()，
    // 让 builder 内部接管所有权。
    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon_as_template(cfg!(target_os = "macos"));

    #[cfg(target_os = "macos")]
    let builder = {
        const TRAY_TEMPLATE_PNG: &[u8] = include_bytes!("../icons/tray-template.png");
        match Image::from_bytes(TRAY_TEMPLATE_PNG) {
            Ok(img) => builder.icon(img),
            Err(_) => builder.icon(
                app.default_window_icon()
                    .cloned()
                    .ok_or_else(|| tauri::Error::AssetNotFound("default_window_icon".into()))?,
            ),
        }
    };
    #[cfg(not(target_os = "macos"))]
    let builder = builder.icon(
        app.default_window_icon()
            .cloned()
            .ok_or_else(|| tauri::Error::AssetNotFound("default_window_icon".into()))?,
    );

    builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            MENU_ID_PLAY_PAUSE => emit_tray_command(app, "play-pause"),
            MENU_ID_PREV => emit_tray_command(app, "prev"),
            MENU_ID_NEXT => emit_tray_command(app, "next"),
            MENU_ID_SHOW => show_main_window(app),
            MENU_ID_SETTINGS => {
                // 用户从托盘点设置时通常窗口处于隐藏态，先弹回再让前端跳路由
                show_main_window(app);
                let _ = app.emit(EVENT_OPEN_SETTINGS, ());
            }
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

fn emit_tray_command(app: &AppHandle, id: &str) {
    let _ = app.emit(EVENT_TRAY_COMMAND, id);
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.show().ok();
        window.set_focus().ok();
        window.unminimize().ok();
    }
}
