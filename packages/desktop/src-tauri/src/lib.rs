mod commands;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .manage(commands::auth::CookieState::default())
        // bili-stream:// custom protocol：让 audio 标签的 src 走 Rust 代理，
        // 由 Rust 注入 Cookie/Origin/Referer/UA 绕过 B 站音视频流反盗链
        .register_asynchronous_uri_scheme_protocol(
            "bili-stream",
            commands::audio_proxy::handle_audio_proxy,
        )
        .setup(|app| {
            // 启动时回放 bilibili_cookies.json 到 CookieState（v1 main.js 行为）
            let handle = app.handle();
            let state = handle.state::<commands::auth::CookieState>();
            if let Err(e) = commands::auth::restore_cookies(handle, &state) {
                eprintln!("[startup] restore_cookies failed: {}", e);
            }

            if let Err(e) = tray::setup_tray(handle) {
                eprintln!("[startup] tray setup failed: {}", e);
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
            commands::spider::qqmusic_search,
            commands::spider::qqmusic_get_lrc,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
