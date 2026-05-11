// 跨平台文件日志（仅 Tauri 端实装）
//
// 设计目标：
// 1. 生产构建里 console.debug 被剥光（__DEV_LOG__=false），文件成为唯一可观测渠道
// 2. 前端通过 invoke('log_write', { level, tag, message, dataJson }) 写日志
// 3. Rust 内部也能写（audio_proxy 关键错误位点），通过 append_log_line() 同步入口
//
// 文件布局：
//   $APP_LOCAL_DATA/logs/         （非 portable）
//   $EXE_DIR/data/logs/           （portable）
//     ├─ app-YYYY-MM-DD.log       （当日日志）
//     ├─ app-YYYY-MM-DD.log.1     （rotate 备份）
//     └─ app-YYYY-MM-DD.log.2     （rotate 备份；超过此数旧文件被丢弃）
//
// Rotate 策略：单日文件超 10 MB 时 N → N+1（最多保留 .1 / .2），新写入到 .log
// 清理策略：启动时扫描目录，删除 mtime > 7 天的 .log* 文件
//
// 并发安全：每次 append 单独 open + write + close（KISS，无 long-lived handle）；
// 用 Mutex<()> 串行化文件操作，避免并发交错写出半行。

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager, Runtime};

use crate::portable;

const LOGS_DIR_NAME: &str = "logs";
/// 单个 .log 文件 rotate 触发阈值（10 MB）。超过此值写入前会触发 rotate。
const ROTATE_BYTES: u64 = 10 * 1024 * 1024;
/// 保留的最大 rotate 序号（含 .1, .2；.log 本身不算）
const MAX_ROTATE_INDEX: u32 = 2;
/// 启动期清理：保留最近 N 天的日志（基于文件 mtime）
const RETENTION_DAYS: u64 = 7;
const RETENTION_SECS: u64 = RETENTION_DAYS * 86400;

/// 日志状态（由 setup 阶段构造并 manage 到 app handle）
pub struct LogState {
    /// 日志目录绝对路径
    pub dir: PathBuf,
    /// 串行化文件操作（append / rotate / clear）；用 std::sync::Mutex 即可，写盘非性能瓶颈
    write_lock: Mutex<()>,
}

impl LogState {
    fn new(dir: PathBuf) -> Self {
        Self {
            dir,
            write_lock: Mutex::new(()),
        }
    }
}

/// 启动期初始化：创建目录 + 清理过期文件
pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<LogState, String> {
    let root = resolve_logs_dir(app)?;
    if !root.exists() {
        fs::create_dir_all(&root).map_err(|e| format!("create logs dir: {}", e))?;
    }
    if let Err(e) = purge_expired_files(&root) {
        eprintln!("[log] purge expired failed: {}", e);
    }
    Ok(LogState::new(root))
}

/// 解析日志目录：portable 模式优先；否则用 app_local_data_dir
fn resolve_logs_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    if let Some(root) = portable::try_data_root() {
        return Ok(root.join(LOGS_DIR_NAME));
    }
    let local = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("app_local_data_dir: {}", e))?;
    Ok(local.join(LOGS_DIR_NAME))
}

/// 清理 mtime 超 RETENTION_SECS 的日志文件（含 .log / .log.1 / .log.2）
fn purge_expired_files(dir: &PathBuf) -> std::io::Result<()> {
    let now = unix_now();
    let entries = match fs::read_dir(dir) {
        Ok(it) => it,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.starts_with("app-") {
            continue;
        }
        let mtime = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(now);
        if now.saturating_sub(mtime) > RETENTION_SECS {
            let _ = fs::remove_file(&path);
        }
    }
    Ok(())
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// 把 unix 秒转换为 (year, month, day, hour, minute, second) UTC
///
/// 采用 Howard Hinnant 的 days_from_civil 逆运算（公共领域算法），
/// 避免引入 chrono / time 整个 crate；约 30 行代码即可覆盖
/// 任何合理日期范围。
fn unix_to_utc_parts(secs: u64) -> (i64, u8, u8, u8, u8, u8) {
    let days = (secs / 86400) as i64;
    let sec_of_day = (secs % 86400) as u32;
    let hour = (sec_of_day / 3600) as u8;
    let minute = ((sec_of_day % 3600) / 60) as u8;
    let second = (sec_of_day % 60) as u8;

    // Hinnant 算法：把 days_since_epoch（1970-01-01 = 0）转为 (year, month, day)
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let m = if mp < 10 { (mp + 3) as u8 } else { (mp - 9) as u8 };
    let year = y + if m <= 2 { 1 } else { 0 };
    (year, m, d, hour, minute, second)
}

/// 当日日志文件名 `app-YYYY-MM-DD.log`（UTC 日期，避免本地时区切换造成文件错乱）
fn today_log_file_name() -> String {
    let (y, m, d, _, _, _) = unix_to_utc_parts(unix_now());
    format!("app-{:04}-{:02}-{:02}.log", y, m, d)
}

/// 当前时间戳的 ISO 8601 字符串（UTC，秒精度）
fn iso_timestamp_now() -> String {
    let (y, m, d, hh, mm, ss) = unix_to_utc_parts(unix_now());
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hh, mm, ss
    )
}

/// 若文件超过 ROTATE_BYTES 则 rotate：.1→.2 / .log→.1 / 新 .log
fn rotate_if_needed(file_path: &PathBuf) -> std::io::Result<()> {
    let size = match fs::metadata(file_path) {
        Ok(m) => m.len(),
        Err(_) => return Ok(()),
    };
    if size < ROTATE_BYTES {
        return Ok(());
    }
    // .2 删除（如果存在）→ .1 重命名为 .2 → .log 重命名为 .1
    for i in (1..=MAX_ROTATE_INDEX).rev() {
        let from = if i == 1 {
            file_path.clone()
        } else {
            file_path.with_extension(format!("log.{}", i - 1))
        };
        let to = file_path.with_extension(format!("log.{}", i));
        if i == MAX_ROTATE_INDEX && to.exists() {
            let _ = fs::remove_file(&to);
        }
        if from.exists() {
            let _ = fs::rename(&from, &to);
        }
    }
    Ok(())
}

/// 把单行日志 append 到当日文件
///
/// 失败仅在内部 eprintln（不抛错给前端，避免业务被日志故障拖累）。
/// 行格式：`[ISO_TIMESTAMP] [LEVEL] [TAG] MESSAGE | DATA_JSON`
pub fn append_log_line(state: &LogState, level: &str, tag: &str, message: &str, data: &str) {
    let _guard = match state.write_lock.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    let file_path = state.dir.join(today_log_file_name());
    if let Err(e) = rotate_if_needed(&file_path) {
        eprintln!("[log] rotate failed: {}", e);
    }
    let line = if data.is_empty() {
        format!(
            "[{}] [{}] [{}] {}\n",
            iso_timestamp_now(),
            level.to_uppercase(),
            tag,
            message
        )
    } else {
        format!(
            "[{}] [{}] [{}] {} | {}\n",
            iso_timestamp_now(),
            level.to_uppercase(),
            tag,
            message,
            data
        )
    };
    match OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
    {
        Ok(mut f) => {
            if let Err(e) = f.write_all(line.as_bytes()) {
                eprintln!("[log] write failed: {}", e);
            }
        }
        Err(e) => eprintln!("[log] open failed ({:?}): {}", file_path, e),
    }
}

/// 验证 level 字段（防止前端传入异常值）
fn normalize_level(raw: &str) -> &'static str {
    match raw.to_lowercase().as_str() {
        "debug" => "debug",
        "info" => "info",
        "warn" => "warn",
        "error" => "error",
        _ => "info",
    }
}

/* ========== Tauri 命令：前端入口 ========== */

#[tauri::command]
pub async fn log_write<R: Runtime>(
    app: AppHandle<R>,
    level: String,
    tag: String,
    message: String,
    data_json: Option<String>,
) -> Result<(), String> {
    let state = match app.try_state::<LogState>() {
        Some(s) => s,
        None => return Err("log state not initialized".into()),
    };
    let level = normalize_level(&level);
    let data = data_json.unwrap_or_default();
    append_log_line(state.inner(), level, &tag, &message, &data);
    Ok(())
}

/// 读取当日日志文件全部内容；不存在返回空串
#[tauri::command]
pub async fn log_read_all<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let state = app
        .try_state::<LogState>()
        .ok_or_else(|| "log state not initialized".to_string())?;
    let file_path = state.dir.join(today_log_file_name());
    match fs::read_to_string(&file_path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("read log failed: {}", e)),
    }
}

/// 清空当日日志（保留 rotate 备份；仅 truncate 当日 .log 文件）
#[tauri::command]
pub async fn log_clear<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app
        .try_state::<LogState>()
        .ok_or_else(|| "log state not initialized".to_string())?;
    let _guard = match state.write_lock.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    let file_path = state.dir.join(today_log_file_name());
    if !file_path.exists() {
        return Ok(());
    }
    fs::write(&file_path, "").map_err(|e| format!("clear log failed: {}", e))
}

/// 返回日志目录绝对路径（前端展示用 + 复制路径）
#[tauri::command]
pub async fn log_get_dir<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let state = app
        .try_state::<LogState>()
        .ok_or_else(|| "log state not initialized".to_string())?;
    Ok(state.dir.to_string_lossy().to_string())
}

/// 在系统文件管理器中打开日志目录
///
/// 不走 plugin-shell.open()：v2 shell:allow-open 默认仅允许 HTTPS URL，
/// 打开本地路径要配 scope 才行；直接走 std::process::Command 更稳。
///
/// 平台映射：
/// - Windows: explorer <dir>
/// - macOS:   open <dir>
/// - Linux:   xdg-open <dir>
#[tauri::command]
pub async fn log_open_dir<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app
        .try_state::<LogState>()
        .ok_or_else(|| "log state not initialized".to_string())?;
    let path = state.dir.clone();
    if !path.exists() {
        return Err(format!("logs dir not found: {}", path.display()));
    }
    open_path_in_file_manager(&path).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn open_path_in_file_manager(path: &PathBuf) -> std::io::Result<()> {
    std::process::Command::new("explorer").arg(path).spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_path_in_file_manager(path: &PathBuf) -> std::io::Result<()> {
    std::process::Command::new("open").arg(path).spawn()?;
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_path_in_file_manager(path: &PathBuf) -> std::io::Result<()> {
    std::process::Command::new("xdg-open").arg(path).spawn()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unix_to_utc_parts_epoch() {
        let (y, m, d, hh, mm, ss) = unix_to_utc_parts(0);
        assert_eq!((y, m, d, hh, mm, ss), (1970, 1, 1, 0, 0, 0));
    }

    #[test]
    fn unix_to_utc_parts_2020_03_15_noon() {
        // 2020-03-15T12:00:00Z = 1584273600
        let (y, m, d, hh, mm, ss) = unix_to_utc_parts(1584273600);
        assert_eq!((y, m, d, hh, mm, ss), (2020, 3, 15, 12, 0, 0));
    }

    #[test]
    fn unix_to_utc_parts_leap_day() {
        // 2024-02-29T00:00:00Z = 1709164800
        let (y, m, d, _, _, _) = unix_to_utc_parts(1709164800);
        assert_eq!((y, m, d), (2024, 2, 29));
    }

    #[test]
    fn unix_to_utc_parts_year_boundary() {
        // 2025-12-31T23:59:59Z = 1767225599
        let (y, m, d, hh, mm, ss) = unix_to_utc_parts(1767225599);
        assert_eq!((y, m, d, hh, mm, ss), (2025, 12, 31, 23, 59, 59));
    }

    #[test]
    fn today_log_file_name_format() {
        let name = today_log_file_name();
        assert!(name.starts_with("app-"));
        assert!(name.ends_with(".log"));
        assert_eq!(name.len(), "app-2025-12-31.log".len());
    }

    #[test]
    fn iso_timestamp_now_format() {
        let s = iso_timestamp_now();
        assert!(s.ends_with('Z'));
        // YYYY-MM-DDTHH:MM:SSZ = 20 chars
        assert_eq!(s.len(), 20);
    }

    #[test]
    fn normalize_level_handles_all_cases() {
        assert_eq!(normalize_level("debug"), "debug");
        assert_eq!(normalize_level("INFO"), "info");
        assert_eq!(normalize_level("Warn"), "warn");
        assert_eq!(normalize_level("ERROR"), "error");
        assert_eq!(normalize_level("unknown"), "info");
        assert_eq!(normalize_level(""), "info");
    }

    #[test]
    fn append_log_line_writes_to_today_file() {
        let tmp = std::env::temp_dir().join(format!(
            "ssp_log_test_{}",
            uuid::Uuid::new_v4().simple()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let state = LogState::new(tmp.clone());

        append_log_line(&state, "info", "[TEST]", "hello world", "");
        append_log_line(&state, "error", "[TEST]", "bad thing", r#"{"code":500}"#);

        let file = tmp.join(today_log_file_name());
        let content = fs::read_to_string(&file).unwrap();
        assert!(content.contains("[INFO]"));
        assert!(content.contains("[TEST]"));
        assert!(content.contains("hello world"));
        assert!(content.contains("[ERROR]"));
        assert!(content.contains(r#"{"code":500}"#));
        let lines: Vec<_> = content.lines().collect();
        assert_eq!(lines.len(), 2);

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn rotate_if_needed_no_op_when_under_threshold() {
        let tmp = std::env::temp_dir().join(format!(
            "ssp_log_rotate_skip_{}",
            uuid::Uuid::new_v4().simple()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let file = tmp.join("app-2025-01-01.log");
        fs::write(&file, "small").unwrap();
        rotate_if_needed(&file).unwrap();
        assert!(file.exists());
        assert!(!tmp.join("app-2025-01-01.log.1").exists());
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn rotate_if_needed_rotates_when_over_threshold() {
        let tmp = std::env::temp_dir().join(format!(
            "ssp_log_rotate_{}",
            uuid::Uuid::new_v4().simple()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let file = tmp.join("app-2025-01-01.log");
        // 写 11 MB 触发 rotate
        let big = vec![b'x'; (ROTATE_BYTES + 1024) as usize];
        fs::write(&file, &big).unwrap();
        rotate_if_needed(&file).unwrap();
        assert!(!file.exists());
        assert!(tmp.join("app-2025-01-01.log.1").exists());
        let _ = fs::remove_dir_all(&tmp);
    }
}
