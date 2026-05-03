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
            commands::spider::qqmusic_search,
            commands::spider::qqmusic_get_lrc,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
