/** 将对象导出为 JSON 文件下载 */
export function objectToDownload(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  textToDownload(json, filename);
}

/** 将文本导出为文件下载 */
export function textToDownload(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
