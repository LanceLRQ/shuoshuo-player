import { getBilibiliMidByURL, formatNumber10K, urlPrefixFixed } from './bilibili';

describe('A4: getBilibiliMidByURL', () => {
  it('纯数字 UID 直接返回', () => {
    expect(getBilibiliMidByURL('283886865')).toBe('283886865');
  });

  it('从 space.bilibili.com URL 提取 UID', () => {
    expect(getBilibiliMidByURL('https://space.bilibili.com/123456')).toBe('123456');
  });

  it('从 URL 末尾带 / 的形式提取', () => {
    expect(getBilibiliMidByURL('https://space.bilibili.com/123456/')).toBe('123456');
  });

  it('非法输入返回空字符串', () => {
    expect(getBilibiliMidByURL('https://example.com/foo')).toBe('');
    expect(getBilibiliMidByURL('')).toBe('');
    expect(getBilibiliMidByURL('abc')).toBe('');
  });
});

describe('A4: formatNumber10K', () => {
  it('< 10000 直接转字符串', () => {
    expect(formatNumber10K(0)).toBe('0');
    expect(formatNumber10K(9999)).toBe('9999');
  });

  it('>= 10000 显示为 X.X 万', () => {
    expect(formatNumber10K(10000)).toBe('1.0万');
    expect(formatNumber10K(15234)).toBe('1.5万');
    expect(formatNumber10K(99999)).toBe('10.0万');
  });
});

describe('A4: urlPrefixFixed', () => {
  it('// 开头补 https', () => {
    expect(urlPrefixFixed('//i0.hdslb.com/x.png')).toBe('https://i0.hdslb.com/x.png');
  });

  it('http:// 替换为 https://', () => {
    expect(urlPrefixFixed('http://i0.hdslb.com/x.png')).toBe('https://i0.hdslb.com/x.png');
  });

  it('已是 https:// 保持不变', () => {
    expect(urlPrefixFixed('https://i0.hdslb.com/x.png')).toBe('https://i0.hdslb.com/x.png');
  });

  it('空值返回空字符串', () => {
    expect(urlPrefixFixed('')).toBe('');
    expect(urlPrefixFixed(undefined as unknown as string)).toBe('');
    expect(urlPrefixFixed(null as unknown as string)).toBe('');
  });
});
