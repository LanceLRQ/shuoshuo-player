import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { FileSaverAdapter } from '@shuoshuo-player/shared';

/**
 * Tauri 端文件保存适配器
 *
 * 流程：
 *   1. plugin-dialog.save() 弹系统原生保存对话框（用户选路径或取消）
 *   2. 用户取消 → 返回 'cancelled'，调用方静默处理
 *   3. 用户确认 → invoke 'save_text_file' 命令让 Rust 端 std::fs::write 落盘
 *
 * 权限要求：capabilities/default.json 必须含 `dialog:default`，否则 plugin 拒绝调用。
 *
 * 与 web/扩展端的差异：
 *   - 给用户明确的"选路径 / 取消"语义，避免静默落到默认 Downloads
 *   - 取消是合法行为，不抛错（与 chrome.downloads / browser native 行为一致）
 */
export class TauriFileSaverAdapter implements FileSaverAdapter {
  async saveText(args: {
    text: string;
    defaultFilename: string;
    extensions?: string[];
  }): Promise<'saved' | 'cancelled'> {
    const path = await save({
      defaultPath: args.defaultFilename,
      filters: args.extensions?.length
        ? [{ name: args.extensions.join('/').toUpperCase(), extensions: args.extensions }]
        : undefined,
    });
    if (!path) return 'cancelled';
    await invoke('save_text_file', { path, content: args.text });
    return 'saved';
  }
}
