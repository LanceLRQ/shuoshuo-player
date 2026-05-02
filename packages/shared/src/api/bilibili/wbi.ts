import md5 from 'md5';

/** WBI 混淆表（B 站客户端固定） */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

function getMixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n])
    .join('')
    .slice(0, 32);
}

/**
 * WBI 签名加密
 * @param params 请求参数
 * @param imgKey nav 接口 wbi_img.img_url 中提取的 key
 * @param subKey nav 接口 wbi_img.sub_url 中提取的 key
 */
export function encWbi(
  params: Record<string, unknown>,
  imgKey: string,
  subKey: string,
): Record<string, unknown> {
  const mixinKey = getMixinKey(imgKey + subKey);
  const wts = Math.round(Date.now() / 1000);

  const newParams: Record<string, unknown> = { ...params, wts };

  const sortedKeys = Object.keys(newParams).sort();
  const query = sortedKeys
    .map((key) => {
      const value = String(newParams[key]).replace(/[!'()*]/g, '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  const wRid = md5(query + mixinKey);
  return { ...newParams, w_rid: wRid };
}

/**
 * 从 WBI URL 中提取 key
 * @example extractWbiKey('https://i0.hdslb.com/bfs/wbi/abc.png') => 'abc'
 */
export function extractWbiKey(url: string): string {
  const match = url.match(/\/([^/]+)\.\w+$/);
  return match ? match[1] : '';
}
