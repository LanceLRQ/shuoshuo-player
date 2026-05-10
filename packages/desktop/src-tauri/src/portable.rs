// portable 模式检测：exe 同目录是否存在 portable.txt 哨兵文件
//
// 设计要点：
// - 启动一次性判定，结果缓存到 OnceCell，避免重复 IO
// - exe 路径解析失败时降级为非 portable（保守）
// - 仅 Windows 启用；其他平台 try_data_root() 始终返回 None
// - WebView2 内部数据（EBWebView）不在此目录管理，仍走系统 LOCALAPPDATA

use once_cell::sync::OnceCell;
use std::path::{Path, PathBuf};

const SENTINEL_FILE: &str = "portable.txt";
const DATA_DIR_NAME: &str = "data";

static PORTABLE: OnceCell<bool> = OnceCell::new();
static EXE_DIR: OnceCell<Option<PathBuf>> = OnceCell::new();

fn exe_dir() -> Option<PathBuf> {
    EXE_DIR
        .get_or_init(|| {
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|x| x.to_path_buf()))
        })
        .clone()
}

/// 纯函数版（可单测）：判定指定目录是否为 portable
pub fn is_portable_in(dir: &Path) -> bool {
    dir.join(SENTINEL_FILE).is_file()
}

/// 当前进程是否处于 portable 模式
pub fn is_portable() -> bool {
    *PORTABLE.get_or_init(|| {
        // 仅 Windows 启用；其他平台直接 false
        if !cfg!(target_os = "windows") {
            return false;
        }
        exe_dir().map(|d| is_portable_in(&d)).unwrap_or(false)
    })
}

/// portable 模式下的应用数据根目录；非 portable 模式返回 None
pub fn try_data_root() -> Option<PathBuf> {
    if is_portable() {
        Some(exe_dir()?.join(DATA_DIR_NAME))
    } else {
        None
    }
}

/// 启动期一次性创建 portable 数据骨架（仅 portable 模式生效）
pub fn ensure_data_skeleton() -> std::io::Result<()> {
    if let Some(root) = try_data_root() {
        std::fs::create_dir_all(root.join("cache").join("audio").join("chunks"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn portable_false_when_no_sentinel() {
        let tmp = std::env::temp_dir().join("ssp_portable_test_no");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        assert!(!is_portable_in(&tmp));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn portable_true_when_sentinel_exists() {
        let tmp = std::env::temp_dir().join("ssp_portable_test_yes");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join(SENTINEL_FILE), "").unwrap();
        assert!(is_portable_in(&tmp));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn portable_false_when_sentinel_is_directory() {
        let tmp = std::env::temp_dir().join("ssp_portable_test_dir");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join(SENTINEL_FILE)).unwrap();
        assert!(!is_portable_in(&tmp));
        let _ = fs::remove_dir_all(&tmp);
    }
}
