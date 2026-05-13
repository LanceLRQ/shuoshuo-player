import {
  timeStampNow,
  formatMillisecond,
  formatTimeLyric,
  formatTimeStampFromServer,
  formatPlayTime,
  filterInvalidFileNameChars,
  sanitizeHtmlTitle,
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
      expect(filterInvalidFileNameChars('abc')).toBe('abc');
    });
  });

  describe('sanitizeHtmlTitle', () => {
    it('普通文本原样返回', () => {
      expect(sanitizeHtmlTitle('普通标题')).toBe('普通标题');
      expect(sanitizeHtmlTitle('hello world')).toBe('hello world');
    });

    it('保留 B 站搜索高亮 <em>/</em>', () => {
      expect(sanitizeHtmlTitle('foo<em>bar</em>baz')).toBe('foo<em>bar</em>baz');
    });

    it('转义 < > 防止注入任意标签', () => {
      expect(sanitizeHtmlTitle('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      );
      expect(sanitizeHtmlTitle('<div>x</div>')).toBe('&lt;div&gt;x&lt;/div&gt;');
    });

    it('转义 <img onerror=...> XSS payload', () => {
      const payload = '<img src=x onerror="alert(1)">';
      const out = sanitizeHtmlTitle(payload);
      // 不能再含可被 HTML 解析为标签的 < ；onerror 仅作纯文本残留无害（< 已被转义）
      expect(out).not.toContain('<img');
      expect(out).not.toMatch(/<[^>]*onerror/i);
      expect(out).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    });

    it('转义 & 字符（HTML 实体安全）', () => {
      expect(sanitizeHtmlTitle('A & B')).toBe('A &amp; B');
    });

    it('转义 " 字符（避免属性逃逸）', () => {
      expect(sanitizeHtmlTitle('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('混合：<em> 保留 + 其他标签转义', () => {
      expect(sanitizeHtmlTitle('<em>关键词</em><script>x</script>')).toBe(
        '<em>关键词</em>&lt;script&gt;x&lt;/script&gt;',
      );
    });

    it('大小写不敏感识别 <em>', () => {
      expect(sanitizeHtmlTitle('<EM>foo</EM>')).toBe('<em>foo</em>');
      expect(sanitizeHtmlTitle('<Em>foo</Em>')).toBe('<em>foo</em>');
    });

    it('空字符串安全', () => {
      expect(sanitizeHtmlTitle('')).toBe('');
    });

    it('& 字符总是被转义（即使输入已是实体如 &lt;）', () => {
      // 输入 raw &lt; 会变 &amp;lt;（过度转义但显示无问题，且仍安全）
      expect(sanitizeHtmlTitle('&lt;')).toBe('&amp;lt;');
    });

    it('<em> 标签外字符仍被转义', () => {
      expect(sanitizeHtmlTitle('<em>safe</em><b>unsafe</b>')).toBe(
        '<em>safe</em>&lt;b&gt;unsafe&lt;/b&gt;',
      );
    });
  });
});
