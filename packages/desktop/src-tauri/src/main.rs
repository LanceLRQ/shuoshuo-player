// Release 模式默认隐藏 Windows 控制台（GUI 子系统）；
// devtools-portable feature 启用时回退到 console 子系统，保留 stdout/stderr 便于调试
#![cfg_attr(
    all(not(debug_assertions), not(feature = "devtools-portable")),
    windows_subsystem = "windows"
)]

fn main() {
    shuoshuo_player_lib::run()
}
