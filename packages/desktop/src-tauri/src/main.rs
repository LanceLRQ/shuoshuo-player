// Release 模式默认隐藏 Windows 控制台（GUI 子系统）；
// console-portable feature 启用时回退到 console 子系统，保留 stdout/stderr 便于调试
// （devtools-portable feature 单独不影响 subsystem，正式 portable 仍是 GUI 模式）
#![cfg_attr(
    all(not(debug_assertions), not(feature = "console-portable")),
    windows_subsystem = "windows"
)]

fn main() {
    shuoshuo_player_lib::run()
}
