/// 把文本内容写入用户指定的本地路径。
///
/// 配合前端 plugin-dialog 的 save() 使用：
///   1. 前端调 dialog.save() 弹原生保存对话框，拿到用户选择的绝对路径
///   2. 前端 invoke('save_text_file') 把 path + content 交给 Rust 写盘
///
/// 不引入 tauri-plugin-fs 是因为：仅需"写一个文本文件"这一个用例，
/// 用 std::fs::write 单 RPC 命令更轻，避免新增插件的权限矩阵和构建体积。
#[tauri::command]
pub fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("写入文件失败：{}", e))
}
