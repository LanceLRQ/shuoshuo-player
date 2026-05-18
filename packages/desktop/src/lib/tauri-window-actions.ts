import { invoke } from '@tauri-apps/api/core';
import type { CloseAction } from '@shuoshuo-player/shared';

/**
 * Tauri 端窗口行为命令的前端 invoke 包装
 *
 * 与 Rust 端 `commands::window::set_close_action` 对应。
 * 由 PlayerProfileStore.closeAction 字段变化时同步调用，
 * Rust 端 `WindowEvent::CloseRequested` handler 据此决定"隐藏到托盘"或"退出应用"。
 *
 * 仅 Tauri 平台调用；Web/扩展端不应 import 此模块（运行时 invoke 会失败）。
 */
export async function setCloseAction(action: CloseAction): Promise<void> {
  await invoke<void>('set_close_action', { action });
}
