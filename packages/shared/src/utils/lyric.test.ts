import { removeEmptyLRCItem, createLyricsFinder, parseLRC } from './lyric';

describe('A2: removeEmptyLRCItem', () => {
  it('剔除带时间戳但内容为空的行', () => {
    const input = ['[00:01.00]hello', '[00:02.00]   ', '[00:03.00]world'].join('\n');
    const out = removeEmptyLRCItem(input);
    expect(out.split('\n')).toEqual(['[00:01.00]hello', '[00:03.00]world']);
  });

  it('保留无时间戳的元数据行', () => {
    const input = ['[ti:title]', '[ar:artist]', '[00:01.00]content'].join('\n');
    const out = removeEmptyLRCItem(input);
    expect(out).toContain('[ti:title]');
    expect(out).toContain('[ar:artist]');
  });

  it('支持冒号变体 [mm:ss:ms]', () => {
    const input = ['[00:01:000]a', '[00:02:000]   '].join('\n');
    const out = removeEmptyLRCItem(input);
    expect(out).toBe('[00:01:000]a');
  });
});

describe('A2: createLyricsFinder 二分查找', () => {
  const lines = [
    { lineTime: 0, lineContent: 'L0' },
    { lineTime: 5, lineContent: 'L1' },
    { lineTime: 10, lineContent: 'L2' },
    { lineTime: 15, lineContent: 'L3' },
  ];

  it('返回当前时间所在行', () => {
    const finder = createLyricsFinder(lines, 0);
    expect(finder(0)).toBe('L0');
    expect(finder(7)).toBe('L1');
    expect(finder(10)).toBe('L2');
    expect(finder(99)).toBe('L3');
  });

  it('当前时间早于首行时返回空字符串', () => {
    const finder = createLyricsFinder(lines, 0);
    expect(finder(-1)).toBe('');
  });

  it('正向 offset 提前显示（offset=2 → 时间 +2）', () => {
    const finder = createLyricsFinder(lines, 2);
    // 实际时间 3，加 offset 后 5，命中 L1
    expect(finder(3)).toBe('L1');
  });

  it('负向 offset 延后显示', () => {
    const finder = createLyricsFinder(lines, -3);
    // 实际时间 5，加 offset 后 2，仍命中 L0
    expect(finder(5)).toBe('L0');
  });

  it('空数组直接返回空', () => {
    expect(createLyricsFinder([], 0)(10)).toBe('');
  });
});

describe('A2: parseLRC', () => {
  it('能解析标准 LRC 文本', () => {
    const text = '[00:01.00]Line A\n[00:02.50]Line B';
    const lrc = parseLRC(text);
    expect(lrc.lyrics.length).toBe(2);
    expect(lrc.lyrics[0].content).toBe('Line A');
  });
});
