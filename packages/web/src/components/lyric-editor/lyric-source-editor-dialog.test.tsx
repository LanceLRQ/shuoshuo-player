import { describe, expect, it } from 'vitest';
import { validateLrcText } from './lyric-source-editor-dialog';

describe('validateLrcText', () => {
  it('空文本视为合法（清空歌词的合法路径）', () => {
    expect(validateLrcText('')).toEqual({ ok: true });
    expect(validateLrcText('   \n  \n')).toEqual({ ok: true });
  });

  it('合法 LRC（含元信息标签 + 时间戳行）通过', () => {
    const text = ['[ti:测试歌曲]', '[ar:艺人]', '[00:01.23]hello', '[01:30.45]world'].join('\n');
    expect(validateLrcText(text)).toEqual({ ok: true });
  });

  it('多重时间戳前缀合法（如 [00:01.23][00:05.00]同一行歌词）', () => {
    const text = '[00:01.23][00:05.00]repeated line';
    expect(validateLrcText(text)).toEqual({ ok: true });
  });

  it('混入纯文本行被拒绝并报告行号', () => {
    const text = ['[00:01.23]ok line', 'plain text without timestamp', '[00:05.00]another'].join(
      '\n',
    );
    const result = validateLrcText(text);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('第 2 行');
  });

  it('全是元信息标签但无任何歌词行被拒绝', () => {
    const text = ['[ti:Title]', '[ar:Artist]'].join('\n');
    const result = validateLrcText(text);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('未识别到');
  });

  it('错误行超过 5 条时只展示前 5 条 + 省略提示', () => {
    const text = Array.from({ length: 8 }, (_, i) => `bad line ${i + 1}`).join('\n');
    const result = validateLrcText(text);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/还有 3 行错误/);
  });
});
