import {
  timeStampNow,
  formatMillisecond,
  formatTimeLyric,
  formatTimeStampFromServer,
  formatPlayTime,
  filterInvalidFileNameChars,
} from './format';

describe('format utils', () => {
  describe('timeStampNow', () => {
    it('返回当前 Unix 秒（整数）', () => {
      const before = Math.floor(Date.now() / 1000);
      const t = timeStampNow();
      const after = Math.floor(Date.now() / 1000);
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(before);
      expect(t).toBeLessThanOrEqual(after);
    });
  });

  describe('formatMillisecond', () => {
    it('零毫秒', () => {
      expect(formatMillisecond(0)).toBe('00:00.000');
    });

    it('秒级补零', () => {
      expect(formatMillisecond(5_500)).toBe('00:05.500');
    });

    it('分钟级', () => {
      expect(formatMillisecond(125_300)).toBe('02:05.300');
    });

    it('超过 60 分钟仍按 MM 输出', () => {
      expect(formatMillisecond(3_660_000)).toBe('61:00.000');
    });
  });

  describe('formatTimeLyric', () => {
    it('LRC 时间标签使用厘秒', () => {
      expect(formatTimeLyric(125_990)).toBe('02:05.99');
    });

    it('整数毫秒余 0 时厘秒为 00', () => {
      expect(formatTimeLyric(60_000)).toBe('01:00.00');
    });

    it('厘秒小于 10 时补零', () => {
      expect(formatTimeLyric(1_050)).toBe('00:01.05');
    });
  });

  describe('formatTimeStampFromServer', () => {
    it('字符串日期可解析', () => {
      const out = formatTimeStampFromServer('2024-01-02T03:04:05.000Z');
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('数字（Unix 秒）可解析', () => {
      const out = formatTimeStampFromServer(1_704_182_400);
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('formatPlayTime', () => {
    it('零秒返回 0:00', () => {
      expect(formatPlayTime(0)).toBe('0:00');
    });

    it('负数返回 0:00', () => {
      expect(formatPlayTime(-1)).toBe('0:00');
    });

    it('NaN/Infinity 返回 0:00', () => {
      expect(formatPlayTime(NaN)).toBe('0:00');
      expect(formatPlayTime(Infinity)).toBe('0:00');
    });

    it('只显示分钟和秒（不补零分钟）', () => {
      expect(formatPlayTime(65)).toBe('1:05');
    });

    it('秒数补零', () => {
      expect(formatPlayTime(7)).toBe('0:07');
    });
  });

  describe('filterInvalidFileNameChars', () => {
    it('过滤 Windows 非法字符', () => {
      expect(filterInvalidFileNameChars('a<b>c:d"e/f\\g|h?i*j')).toBe('abcdefghij');
    });

    it('保留中文与空格', () => {
      expect(filterInvalidFileNameChars('我的 歌单')).toBe('我的 歌单');
    });

    it('指定替换字符', () => {
      expect(filterInvalidFileNameChars('a/b', '_')).toBe('a_b');
    });

    it('过滤控制字符', () => {
      expect(filterInvalidFileNameChars('abc')).toBe('abc');
    });
  });
});
