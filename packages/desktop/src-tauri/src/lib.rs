mod commands;
mod portable;
mod tray;

use tauri::{Manager, RunEvent, WindowEvent};

use commands::tray::TrayMenuState;
use commands::window::{CloseAction, CloseActionState, IsQuittingState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::auth::CookieState::default())
        .manage(CloseActionState::default())
        .manage(IsQuittingState::default())
        .manage(TrayMenuState::default())
        // bili-stream:// custom protocol：让 audio 标签的 src 走 Rust 代理，
        // 由 Rust 注入 Cookie/Origin/Referer/UA 绕过 B 站音视频流反盗链
        .register_asynchronous_uri_scheme_protocol(
            "bili-stream",
            commands::audio_proxy::handle_audio_proxy,
        )
        .setup(|app| {
            // portable 模式：创建 <exe_dir>/data/ 骨架；非 portable 模式 no-op
            if let Err(e) = portable::ensure_data_skeleton() {
                eprintln!("[startup] portable data skeleton init failed: {}", e);
            }

            // 初始化文件日志（最先做：之后所有 setup 步骤的错误都可落盘）
            let handle = app.handle();
            match commands::log::init(handle) {
                Ok(log_state) => {
                    app.manage(log_state);
                }
                Err(e) => {
                    eprintln!("[startup] log init failed: {} (file logging disabled)", e);
                }
            }

            // 启动时回放 bilibili_cookies.json 到 CookieState（v1 main.js 行为）
            let state = handle.state::<commands::auth::CookieState>();
            if let Err(e) = commands::auth::restore_cookies(handle, &state) {
                eprintln!("[startup] restore_cookies failed: {}", e);
            }

            // 初始化音频缓存（创建目录 + 加载 index.json LRU 索引）
            // 失败时降级为空 cache state，handler 会全走 reqwest 不影响功能
            match commands::audio_cache::init(handle) {
                Ok(cache_state) => {
                    app.manage(cache_state);
                }
                Err(e) => {
                    eprintln!("[startup] audio_cache init failed: {} (cache disabled)", e);
                }
            }

            if let Err(e) = tray::setup_tray(handle) {
                eprintln!("[startup] tray setup failed: {}", e);
            }

            // 拦截主窗口的关闭事件：根据用户偏好"隐藏到托盘"或放行默认退出。
            //
            // 设计要点：
            // - 仅挂在 main window，登录窗口（auth::bilibili_login 临时创建）正常退出
            // - is_quitting=true 时直接 return → 不调 prevent_close → 让默认关闭走完
            //   （配合托盘"退出"菜单与 ExitRequested 监听器，构成两条独立 quit 路径）
            // - hide() 失败仅 .ok() 吞错：极端窗口状态下不应阻塞用户的关闭意图
            if let Some(main_window) = handle.get_webview_window("main") {
                let app_handle = handle.clone();
                main_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        let quit_state = app_handle.state::<IsQuittingState>();
                        if quit_state.is_quitting() {
                            return;
                        }
                        let action = {
                            let close_state = app_handle.state::<CloseActionState>();
                            let guard = match close_state.0.lock() {
                                Ok(g) => g,
                                Err(poisoned) => poisoned.into_inner(),
                            };
                            *guard
                        };
                        match action {
                            CloseAction::MinimizeToTray => {
                                api.prevent_close();
                                if let Some(w) = app_handle.get_webview_window("main") {
                                    w.hide().ok();
                                }
                            }
                            CloseAction::Exit => {
                                quit_state.mark_quitting();
                                app_handle.exit(0);
                            }
                        }
                    }
                });
            }

            // Portable 调试能力：两种触发方式
            // - console-portable feature（dev 调试包）：启动时自动开 DevTools
            // - 否则（正式 portable）：检查 CLI 参数 --debug，命中才开
            #[cfg(feature = "devtools-portable")]
            {
                let auto_open = cfg!(feature = "console-portable");
                let cli_debug = std::env::args().any(|a| a == "--debug");
                if auto_open || cli_debug {
                    if let Some(main_window) = handle.get_webview_window("main") {
                        main_window.open_devtools();
                        eprintln!(
                            "[startup] devtools opened (auto_open={}, cli_debug={})",
                            auto_open, cli_debug
                        );
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::store::store_get,
            commands::store::store_set,
            commands::store::store_remove,
            commands::auth::bilibili_login,
            commands::auth::bilibili_logout,
            commands::auth::get_bilibili_cookies,
            commands::audio_cache::get_cache_stats,
            commands::audio_cache::set_cache_max_bytes,
            commands::audio_cache::clear_cache,
            commands::audio_cache::get_cache_dir,
            commands::audio_cache::set_cache_dir,
            commands::spider::qqmusic_search,
            commands::spider::qqmusic_get_lrc,
            commands::file::save_text_file,
            commands::log::log_write,
            commands::log::log_read_all,
            commands::log::log_clear,
            commands::log::log_get_dir,
            commands::log::log_open_dir,
            commands::window::set_window_theme,
            commands::window::set_close_action,
            commands::tray::tray_set_track_label,
            commands::tray::tray_set_play_state,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            // ExitRequested：macOS ⌘Q / Dock 右键 Quit / app.exit(0) 都会先走这里。
            // 置位 is_quitting，让窗口的 CloseRequested handler 不再拦截关闭事件，
            // 实现"两条独立 quit 路径都安全收敛"——托盘菜单退出 / 系统级退出请求。
            RunEvent::ExitRequested { .. } => {
                let state = app_handle.state::<IsQuittingState>();
                state.mark_quitting();
            }
            // Reopen 是 macOS 专属事件（对应 AppKit applicationShouldHandleReopen）：
            // 当主窗口被 hide() 隐藏到 Dock + 菜单栏托盘后，用户点 Dock 图标会派发本事件。
            // has_visible_windows=false 表示当前没有可见窗口 → 恢复主窗口；
            // 否则 Tauri/AppKit 默认行为已经能把窗口带到最前，无需干预。
            #[cfg(target_os = "macos")]
            RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    window.show().ok();
                    window.unminimize().ok();
                    window.set_focus().ok();
                }
            }
            _ => {}
        });
}
