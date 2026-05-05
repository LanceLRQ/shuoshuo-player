/**
 * TauriBilibiliHttpAdapter 单测
 *
 * 验证：
 * - URL 拼接：params → query string，已含 ? 时用 & 拼
 * - Cookie 注入：调 invoke('get_bilibili_cookies')；空字符串不写 Cookie header
 * - Referer / User-Agent 注入（替代 Chrome 扩展 rules.json 的 DNR 规则）
 * - 原 headers 透传（含 Content-Type）
 * - GET 不带 body；POST 字符串 body 原样传
 * - JSON 默认解析、其他 responseType 走对应分支
 * - invoke 失败时容错继续（cookie header 留空）
 */

import type { InternalAxiosRequestConfig } from 'axios';

const mockFetch = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import {
  createTauriBilibiliHttpAdapter,
  createTauriCloudHttpAdapter,
} from './tauri-bilibili-http-adapter';

function makeResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, init);
}

function makeConfig(over: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return {
    url: 'https://api.bilibili.com/x/web-interface/nav',
    method: 'get',
    headers: {} as InternalAxiosRequestConfig['headers'],
    ...over,
  } as InternalAxiosRequestConfig;
}

describe('TauriBilibiliHttpAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue('SESSDATA=xyz; bili_jct=abc');
    mockFetch.mockResolvedValue(makeResponse({ code: 0, data: { ok: 1 } }));
  });

  it('GET 请求：params → query string，方法转大写，无 body', async () => {
    const adapter = createTauriBilibiliHttpAdapter();
    await adapter(makeConfig({ params: { mid: '283886865', ps: 30 } }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.bilibili.com/x/web-interface/nav?mid=283886865&ps=30');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('URL 已含 ? 时用 & 追加 query', async () => {
    const adapter = createTauriBilibiliHttpAdapter();
    await adapter(
      makeConfig({
        url: 'https://api.bilibili.com/foo?prefilled=1',
        params: { extra: 'x' },
      }),
    );
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.bilibili.com/foo?prefilled=1&extra=x');
  });

  it('注入 Referer / User-Agent / Cookie', async () => {
    const adapter = createTauriBilibiliHttpAdapter();
    await adapter(makeConfig());

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('Referer')).toBe('https://www.bilibili.com/');
    expect(headers.get('User-Agent')).toContain('Chrome/');
    expect(headers.get('Cookie')).toBe('SESSDATA=xyz; bili_jct=abc');
  });

  it('Cookie 为空字符串时不写 Cookie header', async () => {
    mockInvoke.mockResolvedValueOnce('');
    const adapter = createTauriBilibiliHttpAdapter();
    await adapter(makeConfig());

    const headers = (mockFetch.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.has('Cookie')).toBe(false);
  });

  it('invoke 失败时容错：cookie header 留空但请求仍发出', async () => {
    mockInvoke.mockRejectedValueOnce('rust error');
    const adapter = createTauriBilibiliHttpAdapter();
    const resp = await adapter(makeConfig());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(resp.status).toBe(200);
    const headers = (mockFetch.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.has('Cookie')).toBe(false);
  });

  it('原 headers 透传（如 Content-Type）', async () => {
    const adapter = createTauriBilibiliHttpAdapter();
    await adapter(
      makeConfig({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Custom': 'foo',
        } as InternalAxiosRequestConfig['headers'],
      }),
    );
    const headers = (mockFetch.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    expect(headers.get('X-Custom')).toBe('foo');
  });

  it('POST 字符串 body 原样传（已被 axios qs.stringify 处理）', async () => {
    const adapter = createTauriBilibiliHttpAdapter();
    await adapter(
      makeConfig({
        method: 'post',
        url: 'https://api.bilibili.com/x/click-interface',
        data: 'aid=1&bvid=BV1xx',
      }),
    );
    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('aid=1&bvid=BV1xx');
  });

  it('responseType=text 时返回字符串', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse('plain text body'));
    const adapter = createTauriBilibiliHttpAdapter();
    const resp = await adapter(makeConfig({ responseType: 'text' }));
    expect(resp.data).toBe('plain text body');
  });

  it('responseType=arraybuffer 时返回 ArrayBuffer', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse('binary'));
    const adapter = createTauriBilibiliHttpAdapter();
    const resp = await adapter(makeConfig({ responseType: 'arraybuffer' }));
    expect(resp.data).toBeInstanceOf(ArrayBuffer);
  });

  it('默认 JSON 解析失败时降级为字符串（buildBilibiliApiCall 期望兼容）', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse('not-json-but-text'));
    const adapter = createTauriBilibiliHttpAdapter();
    const resp = await adapter(makeConfig());
    expect(resp.data).toBe('not-json-but-text');
  });

  it('返回的 AxiosResponse 形态完整：data/status/statusText/headers/config', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ code: 0, data: { mid: 1 } }, { status: 200, statusText: 'OK' }),
    );
    const adapter = createTauriBilibiliHttpAdapter();
    const cfg = makeConfig();
    const resp = await adapter(cfg);

    expect(resp.data).toEqual({ code: 0, data: { mid: 1 } });
    expect(resp.status).toBe(200);
    expect(resp.statusText).toBe('OK');
    expect(typeof resp.headers).toBe('object');
    expect(resp.config).toBe(cfg);
  });

  it('null/undefined 的 params 项被过滤', async () => {
    const adapter = createTauriBilibiliHttpAdapter();
    await adapter(
      makeConfig({
        params: { keep: 'a', drop1: null, drop2: undefined } as Record<string, unknown>,
      }),
    );
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.bilibili.com/x/web-interface/nav?keep=a');
  });
});

describe('TauriCloudHttpAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInvoke.mockReset();
    mockFetch.mockResolvedValue(makeResponse({ code: 0, data: {} }));
  });

  it('不调用 invoke (get_bilibili_cookies)，避免无谓 IPC', async () => {
    const adapter = createTauriCloudHttpAdapter();
    await adapter(makeConfig({ url: 'https://shuoshuo.sikong.ren/api/lyric/manage/new' }));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('不注入 Referer / Origin / User-Agent / Cookie', async () => {
    const adapter = createTauriCloudHttpAdapter();
    await adapter(makeConfig({ url: 'https://shuoshuo.sikong.ren/api/account/check_login' }));
    const headers = (mockFetch.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.has('Referer')).toBe(false);
    expect(headers.has('Origin')).toBe(false);
    expect(headers.has('User-Agent')).toBe(false);
    expect(headers.has('Cookie')).toBe(false);
  });

  it('原 headers 透传（如 Authorization / Content-Type）', async () => {
    const adapter = createTauriCloudHttpAdapter();
    await adapter(
      makeConfig({
        url: 'https://shuoshuo.sikong.ren/api/lyric/list',
        headers: {
          Authorization: 'Bearer xxx',
          'Content-Type': 'application/json',
        } as InternalAxiosRequestConfig['headers'],
      }),
    );
    const headers = (mockFetch.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer xxx');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('GET/POST/响应解析等通用行为与 bilibili adapter 一致', async () => {
    const adapter = createTauriCloudHttpAdapter();
    const resp = await adapter(
      makeConfig({
        url: 'https://shuoshuo.sikong.ren/api/lyric/manage/new',
        method: 'post',
        data: '{"title":"x"}',
      }),
    );
    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"title":"x"}');
    expect(resp.status).toBe(200);
  });

  it('config.url 是相对路径时拼接 baseURL（cloudService 拦截器设置 baseURL 后）', async () => {
    const adapter = createTauriCloudHttpAdapter();
    await adapter(
      makeConfig({
        url: '/live-slicer/list',
        baseURL: 'https://shuoshuo.sikong.ren/api',
      } as Partial<InternalAxiosRequestConfig>),
    );
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://shuoshuo.sikong.ren/api/live-slicer/list');
  });

  it('baseURL 末尾斜杠 + url 不含斜杠都能正确拼', async () => {
    const adapter = createTauriCloudHttpAdapter();
    await adapter(
      makeConfig({
        url: 'lyric/list',
        baseURL: 'https://shuoshuo.sikong.ren/api/',
      } as Partial<InternalAxiosRequestConfig>),
    );
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://shuoshuo.sikong.ren/api/lyric/list');
  });

  it('config.url 已是绝对 URL 时忽略 baseURL', async () => {
    const adapter = createTauriCloudHttpAdapter();
    await adapter(
      makeConfig({
        url: 'https://shuoshuo.sikong.ren/api/account/check_login',
        baseURL: 'https://other.example.com/v2',
      } as Partial<InternalAxiosRequestConfig>),
    );
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://shuoshuo.sikong.ren/api/account/check_login');
  });
});
