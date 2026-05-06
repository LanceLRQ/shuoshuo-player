import { getPlatformBridge } from '../platform';

/** 将对象导出为 JSON 文件下载 */
export async function objectToDownload(
  data: unknown,
  filename: string,
): Promise<'saved' | 'cancelled'> {
  const json = JSON.stringify(data, null, 2);
  return textToDownload(json, filename);
}

/**
 * 将文本导出为文件下载。
 *
 * 平台分支：
 * - Tauri（bridge.fileSaver 存在）：弹系统保存对话框，用户可选路径或取消
 * - Web/扩展（无 fileSaver）：浏览器原生 a[download] 触发下载到默认目录
 *
 * @returns 'saved' = 已落盘；'cancelled' = 用户在 Tauri 对话框中取消（仅 Tauri 端可能返回）
 */
export async function textToDownload(
  text: string,
  filename: string,
): Promise<'saved' | 'cancelled'> {
  // 优先走 PlatformBridge.fileSaver（Tauri 端实现），让用户主动选路径
  try {
    const bridge = getPlatformBridge();
    if (bridge.fileSaver) {
      const ext = filename.includes('.') ? filename.split('.').pop() : undefined;
      return await bridge.fileSaver.saveText({
        text,
        defaultFilename: filename,
        extensions: ext ? [ext] : undefined,
      });
    }
  } catch {
    // bridge 未初始化（如纯单测环境）→ 静默回退浏览器原生下载，不阻断业务
  }

  // 浏览器原生下载：a[download] 触发，到浏览器默认下载目录
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return 'saved';
}

/** 创建 JSON 文件加载器（弹出系统文件选择对话框） */
export function createJsonFileLoader(
  callback: (data: unknown) => void,
  errorCallback?: (err: Error) => void,
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        callback(data);
      } catch (err) {
        errorCallback?.(err as Error);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/** 创建歌词文件加载器（.lrc / .txt） */
export function createLyricFileLoader(
  callback: (text: string) => void,
  errorCallback?: (err: Error) => void,
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.lrc,.txt';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        callback(ev.target?.result as string);
      } catch (err) {
        errorCallback?.(err as Error);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
