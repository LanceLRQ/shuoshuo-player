// Tauri Store 命令
//
// 关键不变量：
// - 仅允许 ["ssp_v2_player_data", "ssp_v2_cloud_api_base_url"] 写入；任何其他 key 命中 Err
// - 持久化到 tauri-plugin-store 默认数据目录下的 store.json
// - 每次写入立即 save()，避免应用退出时丢失（节流由前端 createPersistMiddleware 负责）
// - key 名带 ssp_v2_ 命名空间前缀；与前端 SSP_V2_NAMESPACE 常量手动同步，
//   改动时务必前后端一并修改（grep `ssp_v2_player_data` 定位所有引用点）

use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

use crate::portable;

const ALLOWED_KEYS: &[&str] = &["ssp_v2_player_data", "ssp_v2_cloud_api_base_url"];
const STORE_FILE_NAME: &str = "store.json";

fn validate_key(key: &str) -> Result<(), String> {
    if ALLOWED_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("Store key not allowed: {}", key))
    }
}

/// portable 模式：返回 <exe_dir>/data/store.json 绝对路径；
/// 非 portable 模式：返回相对名 store.json（plugin-store 会拼到 app_data_dir 下）
fn store_path() -> String {
    match portable::try_data_root() {
        Some(root) => root.join(STORE_FILE_NAME).to_string_lossy().into_owned(),
        None => STORE_FILE_NAME.to_string(),
    }
}

#[tauri::command]
pub async fn store_get<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    validate_key(&key)?;
    let store = app.store(store_path()).map_err(|e| e.to_string())?;
    Ok(store.get(&key))
}

#[tauri::command]
pub async fn store_set<R: Runtime>(
    app: AppHandle<R>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    validate_key(&key)?;
    let store = app.store(store_path()).map_err(|e| e.to_string())?;
    store.set(key, value);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn store_remove<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<(), String> {
    validate_key(&key)?;
    let store = app.store(store_path()).map_err(|e| e.to_string())?;
    store.delete(&key);
    store.save().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_key;

    #[test]
    fn allowed_keys_pass() {
        assert!(validate_key("ssp_v2_player_data").is_ok());
        assert!(validate_key("ssp_v2_cloud_api_base_url").is_ok());
    }

    #[test]
    fn other_keys_rejected() {
        assert!(validate_key("system").is_err());
        assert!(validate_key("evil").is_err());
        assert!(validate_key("").is_err());
        assert!(validate_key("Player_Data").is_err());
        // 未带 ssp_v2_ 前缀的旧 key 名应当被拒绝（防止误用 v1 风格裸名）
        assert!(validate_key("player_data").is_err());
        assert!(validate_key("cloud_api_base_url").is_err());
    }

    #[test]
    fn rejection_message_contains_key() {
        let err = validate_key("evil").unwrap_err();
        assert!(err.contains("evil"));
    }
}
