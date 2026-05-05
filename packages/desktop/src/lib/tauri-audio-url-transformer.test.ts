import { shouldProxyHost, transformBilibiliAudioUrl } from './tauri-audio-url-transformer';

describe('shouldProxyHost', () => {
  it('命中后缀 .bilivideo.com', () => {
    expect(shouldProxyHost('upos-sz-mirrorcos.bilivideo.com')).toBe(true);
    expect(shouldProxyHost('cn-shanghai-cu-01-09.bilivideo.com')).toBe(true);
  });

  it('命中后缀 .akamaized.net', () => {
    expect(shouldProxyHost('xy223x12x123x46xy.mcdn.akamaized.net')).toBe(true);
  });

  it('命中后缀 .hdslb.com', () => {
    expect(shouldProxyHost('i0.hdslb.com')).toBe(true);
  });

  it('命中前缀 upos-', () => {
    expect(shouldProxyHost('upos-hz-mirrorakam.akamaized.net')).toBe(true);
    expect(shouldProxyHost('upos-anything.example.com')).toBe(true);
  });

  it('未命中：白名单外的域名', () => {
    expect(shouldProxyHost('example.com')).toBe(false);
    expect(shouldProxyHost('shuoshuo.sikong.ren')).toBe(false);
    expect(shouldProxyHost('api.bilibili.com')).toBe(false); // bilibili.com 不在 audio 代理白名单
  });

  it('大小写不敏感', () => {
    expect(shouldProxyHost('UPOS-XX.BILIVIDEO.COM')).toBe(true);
  });
});

describe('transformBilibiliAudioUrl', () => {
  it('B 站 m4s URL 包装为 bili-stream://localhost/?url=ENCODED', () => {
    const raw =
      'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/67/73/37943577367/37943577367-1-30280.m4s?e=xxx';
    const out = transformBilibiliAudioUrl(raw);
    expect(out.startsWith('bili-stream://localhost/?url=')).toBe(true);
    expect(out).toContain(encodeURIComponent(raw));
  });

  it('非白名单 URL 透传', () => {
    const raw = 'https://shuoshuo.sikong.ren/api/lyric/list';
    expect(transformBilibiliAudioUrl(raw)).toBe(raw);
  });

  it('已是 bili-stream:// 不重复包装（幂等）', () => {
    const wrapped = 'bili-stream://localhost/?url=https%3A%2F%2Fexample.com';
    expect(transformBilibiliAudioUrl(wrapped)).toBe(wrapped);
  });

  it('空字符串透传（loading / 无 audio 场景）', () => {
    expect(transformBilibiliAudioUrl('')).toBe('');
  });

  it('非法 URL 透传（不抛错）', () => {
    expect(transformBilibiliAudioUrl('not-a-url')).toBe('not-a-url');
  });

  it('http 协议同样能命中（非 https）', () => {
    const raw = 'http://upos-test.bilivideo.com/foo.m4s';
    const out = transformBilibiliAudioUrl(raw);
    expect(out.startsWith('bili-stream://')).toBe(true);
  });

  it('encode 包含特殊字符的 URL（query 含 &/=）', () => {
    const raw = 'https://upos-x.bilivideo.com/path?a=1&b=2';
    const out = transformBilibiliAudioUrl(raw);
    expect(decodeURIComponent(out.split('?url=')[1] ?? '')).toBe(raw);
  });
});
