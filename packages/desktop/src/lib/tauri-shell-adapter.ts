import { open } from '@tauri-apps/plugin-shell';
import type { ShellAdapter } from '@shuoshuo-player/shared';

/**
 * Tauri 端外链适配器
 *
 * 调用 tauri-plugin-shell 的 open() 让系统默认浏览器打开链接，
 * 而非在 Tauri WebView 内嵌打开（与 v1 Electron shell.openExternal 行为一致）。
 *
 * 权限要求：capabilities/default.json 必须包含 `shell:allow-open`，
 * 否则 plugin 会拒绝调用。
 */
export class TauriShellAdapter implements ShellAdapter {
  async openExternal(url: string): Promise<void> {
    if (!url) return;
    await open(url);
  }
}
