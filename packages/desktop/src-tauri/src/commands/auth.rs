// Phase 1 占位骨架，完整实现见 phase-6-tauri-desktop.md
// 关键不变量：登录 URL 必须为 https://passport.bilibili.com/pc/passport/login
// 导航到 *://www.bilibili.com/* 时关闭登录窗口并 emit bilibili:login_success
// Cookie 持久化前剥离 session=false 标记

use std::sync::Mutex;

#[derive(Default)]
pub struct CookieState(#[allow(dead_code)] pub Mutex<Vec<String>>);

#[tauri::command]
pub async fn bilibili_login() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn bilibili_logout() -> Result<(), String> {
    Ok(())
}
