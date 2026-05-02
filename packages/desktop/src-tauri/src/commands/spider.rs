// Phase 1 占位骨架，完整实现见 phase-6-tauri-desktop.md
// QQ 音乐搜索 + 歌词抓取（仅桌面端使用）

#[tauri::command]
pub async fn qqmusic_search(_keyword: String) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!([]))
}

#[tauri::command]
pub async fn qqmusic_get_lrc(_song_mid: String) -> Result<String, String> {
    Ok(String::new())
}
