mod commands;
mod portable;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::auth::CookieState::default())
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

            // 启动时回放 bilibili_cookies.json 到 CookieState（v1 main.js 行为）
            let handle = app.handle();
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
