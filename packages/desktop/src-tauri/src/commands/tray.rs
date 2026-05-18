use std::sync::Mutex;

use tauri::{menu::MenuItem, AppHandle, State, Wry};

/// 托盘菜单中"运行时动态文案"两项的句柄容器
///
/// 由 `tray::setup_tray` 构建后写入，前端通过 invoke 命令调 `MenuItem::set_text()`
/// 修改可见文案——实现"当前曲目 / 播放暂停"随播放器状态实时变化的能力。
///
/// Mutex<Option<MenuItem>> 模式：
/// - tray setup 失败时 None 兜底，invoke 命令读到 None 直接返回 Ok（noop），避免类型化为 panic
/// - 跨线程安全（Tauri menu_event handler 在事件线程触发，invoke 在 IPC 线程）
pub struct TrayMenuState {
    pub track_item: Mutex<Option<MenuItem<Wry>>>,
    pub play_pause_item: Mutex<Option<MenuItem<Wry>>>,
}

impl Default for TrayMenuState {
    fn default() -> Self {
        Self {
            track_item: Mutex::new(None),
            play_pause_item: Mutex::new(None),
        }
    }
}

/// 更新托盘菜单顶部"当前曲目"标签文案。
///
/// 前端 `tray-sync` 在曲目变化时调；空串视为"未在播放"。
/// 句柄尚未注册（tray setup 失败兜底）时返回 Ok（noop），不向上抛错阻塞前端。
#[tauri::command]
pub fn tray_set_track_label(
    state: State<'_, TrayMenuState>,
    _app: AppHandle,
    label: String,
) -> Result<(), String> {
    let guard = state
        .track_item
        .lock()
        .map_err(|e| format!("TrayMenuState.track_item 锁中毒：{}", e))?;
    let Some(item) = guard.as_ref() else {
        return Ok(());
    };
    let text = if label.is_empty() { "未在播放" } else { &label };
    item.set_text(text)
        .map_err(|e| format!("track_item.set_text 失败：{}", e))
}

/// 更新托盘菜单"播放/暂停"项的文案。
///
/// 由前端 `isPlaying` 变化驱动；true → "暂停"，false → "播放"。
#[tauri::command]
pub fn tray_set_play_state(
    state: State<'_, TrayMenuState>,
    _app: AppHandle,
    is_playing: bool,
) -> Result<(), String> {
    let guard = state
        .play_pause_item
        .lock()
        .map_err(|e| format!("TrayMenuState.play_pause_item 锁中毒：{}", e))?;
    let Some(item) = guard.as_ref() else {
        return Ok(());
    };
    let text = if is_playing { "暂停" } else { "播放" };
    item.set_text(text)
        .map_err(|e| format!("play_pause_item.set_text 失败：{}", e))
}
