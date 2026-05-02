// Phase 1 占位骨架，完整实现见 phase-6-tauri-desktop.md
// 关键不变量：仅允许 ["player_data", "cloud_api_base_url"] 写入

const ALLOWED_KEYS: &[&str] = &["player_data", "cloud_api_base_url"];

fn validate_key(key: &str) -> Result<(), String> {
    if ALLOWED_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("Store key not allowed: {}", key))
    }
}

#[tauri::command]
pub async fn store_get(key: String) -> Result<Option<serde_json::Value>, String> {
    validate_key(&key)?;
    Ok(None)
}

#[tauri::command]
pub async fn store_set(key: String, _value: serde_json::Value) -> Result<(), String> {
    validate_key(&key)?;
    Ok(())
}

#[tauri::command]
pub async fn store_remove(key: String) -> Result<(), String> {
    validate_key(&key)?;
    Ok(())
}
