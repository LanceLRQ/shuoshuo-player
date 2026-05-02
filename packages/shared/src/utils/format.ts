/** 当前 Unix 时间戳（秒） */
export function timeStampNow(): number {
  return Math.floor(Date.now() / 1000);
}

/** 格式化毫秒为 MM:SS.mmm */
export function formatMillisecond(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
    milliseconds,
  ).padStart(3, '0')}`;
}

/** 格式化为 LRC 时间标签 MM:SS.CC（厘秒） */
export function formatTimeLyric(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
    centiseconds,
  ).padStart(2, '0')}`;
}

/** 格式化服务器时间戳：ISO 字符串或 Unix 秒 → YYYY-MM-DD HH:mm:ss */
export function formatTimeStampFromServer(d: string | number): string {
  const date = new Date(typeof d === 'string' ? d : d * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 过滤非法文件名字符 */
export function filterInvalidFileNameChars(input: string, replacement = ''): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[<>:"/\\|?*\x00-\x1f]/g, replacement);
}
