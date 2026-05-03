// Tauri Store 命令
//
// 关键不变量：
// - 仅允许 ["player_data", "cloud_api_base_url"] 写入；任何其他 key 命中 Err
// - 持久化到 tauri-plugin-store 默认数据目录下的 store.json
// - 每次写入立即 save()，避免应用退出时丢失（节流由前端 createPersistMiddleware 负责）

use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const ALLOWED_KEYS: &[&str] = &["player_data", "cloud_api_base_url"];
const STORE_FILE: &str = "store.json";

fn validate_key(key: &str) -> Result<(), String> {
    if ALLOWED_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("Store key not allowed: {}", key))
    }
}

#[tauri::command]
pub async fn store_get<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    validate_key(&key)?;
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store.get(&key))
}

#[tauri::command]
pub async fn store_set<R: Runtime>(
    app: AppHandle<R>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    validate_key(&key)?;
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(key, value);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn store_remove<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<(), String> {
    validate_key(&key)?;
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.delete(&key);
    store.save().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_key;

    #[test]
    fn allowed_keys_pass() {
        assert!(validate_key("player_data").is_ok());
        assert!(validate_key("cloud_api_base_url").is_ok());
    }

    #[test]
    fn other_keys_rejected() {
        assert!(validate_key("system").is_err());
        assert!(validate_key("evil").is_err());
        assert!(validate_key("").is_err());
        assert!(validate_key("Player_Data").is_err());
    }

    #[test]
    fn rejection_message_contains_key() {
        let err = validate_key("evil").unwrap_err();
        assert!(err.contains("evil"));
    }
}
