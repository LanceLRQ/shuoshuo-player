import { Lrc } from 'lrc-kit';

/** 移除空白歌词行（保留无时间标签行；带标签但内容为空的行剔除） */
export function removeEmptyLRCItem(lrcText: string): string {
  return lrcText
    .split('\n')
    .filter((line) => {
      const match = line.match(/^\[(\d{2}:\d{2}[.:]\d{2,3})\](.*)/);
      if (!match) return true;
      return match[2].trim() !== '';
    })
    .join('\n');
}

/**
 * 创建歌词查找器（二分搜索）
 * @param lyricsArray 已解析的歌词行数组（lineTime 单位：秒）
 * @param offset 偏移秒数（正数提前显示，负数延后）
 */
export function createLyricsFinder(
  lyricsArray: Array<{ lineTime: number; lineContent: string }>,
  offset: number = 0,
): (currentTime: number) => string {
  return (currentTime: number): string => {
    if (!lyricsArray || lyricsArray.length === 0) return '';
    const time = currentTime + offset;
    let low = 0;
    let high = lyricsArray.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lyricsArray[mid].lineTime <= time) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return high >= 0 ? lyricsArray[high].lineContent : '';
  };
}

/** 解析 LRC 文本（直接复用 lrc-kit） */
export function parseLRC(lrcText: string) {
  return Lrc.parse(lrcText);
}
