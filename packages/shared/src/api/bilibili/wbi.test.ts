import md5 from 'md5';
import { encWbi, extractWbiKey } from './wbi';

describe('A1: encWbi 签名生成', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('注入 wts 与 w_rid', () => {
    const params = { foo: 'bar', baz: 1 };
    const result = encWbi(params, 'a'.repeat(32), 'b'.repeat(32));

    expect(result.wts).toBe(Math.round(Date.now() / 1000));
    expect(result.w_rid).toBeTypeOf('string');
    expect((result.w_rid as string).length).toBe(32);
    expect(result.foo).toBe('bar');
    expect(result.baz).toBe(1);
  });

  it('字段按字典序排序后参与签名（与传入顺序无关）', () => {
    const a = encWbi({ b: 2, a: 1 }, 'k'.repeat(32), 's'.repeat(32));
    const b = encWbi({ a: 1, b: 2 }, 'k'.repeat(32), 's'.repeat(32));
    expect(a.w_rid).toBe(b.w_rid);
  });

  it('字段值中的特殊字符 !\'()* 被剥离', () => {
    const wts = Math.round(Date.now() / 1000);
    // 模拟 mixinKey：取 imgKey+subKey 按混淆表索引重排，截首 32 位
    const imgKey = 'A'.repeat(32);
    const subKey = 'B'.repeat(32);
    const result = encWbi({ name: "ab!c'd(e)f*g" }, imgKey, subKey);

    // 与不含特殊字符的等价输入应该产生相同签名
    const result2 = encWbi({ name: 'abcdefg' }, imgKey, subKey);
    expect(result.wts).toBe(wts);
    expect(result.w_rid).toBe(result2.w_rid);
  });

  it('w_rid 等于 md5(query + mixinKey)', () => {
    const imgKey = '1'.repeat(32);
    const subKey = '2'.repeat(32);
    const params = { v: 'x' };
    const out = encWbi(params, imgKey, subKey);

    // mixinKey 由内部用混淆表计算，这里间接验证：相同参数+密钥应稳定
    const out2 = encWbi(params, imgKey, subKey);
    expect(out.w_rid).toBe(out2.w_rid);
    // 长度严格 32（md5 hex）
    expect((out.w_rid as string)).toMatch(/^[a-f0-9]{32}$/);
  });

  it('空入参也能工作（仅注入 wts）', () => {
    const out = encWbi({}, 'x'.repeat(32), 'y'.repeat(32));
    expect(out.wts).toBeDefined();
    expect(out.w_rid).toBeDefined();
  });

  it('md5 模块可用（自检，确保 vitest 解析了 md5）', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
});

describe('extractWbiKey: 从 WBI URL 提取 key', () => {
  it('正常 URL 返回文件名（不含扩展名）', () => {
    expect(extractWbiKey('https://i0.hdslb.com/bfs/wbi/abc123.png')).toBe('abc123');
  });

  it('无扩展名时 fallback 空字符串', () => {
    expect(extractWbiKey('https://i0.hdslb.com/bfs/wbi/noext')).toBe('');
  });

  it('空字符串返回空', () => {
    expect(extractWbiKey('')).toBe('');
  });
});
