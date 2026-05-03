import {
  setCloudApiBaseUrl,
  getCloudApiBaseUrl,
  setCloudServiceToken,
  setWbiInfo,
  setSessionExpiredHandler,
  buildBilibiliApiCall,
  buildCloudApiCall,
  bilibiliPure,
  cloudPure,
} from './client';
import { DEFAULT_CLOUD_API_BASE_URL } from '../constants';

describe('A9: setCloudApiBaseUrl 边界', () => {
  afterEach(() => {
    setCloudApiBaseUrl(DEFAULT_CLOUD_API_BASE_URL);
  });

  it('空字符串 fallback 默认', () => {
    setCloudApiBaseUrl('');
    expect(getCloudApiBaseUrl()).toBe(DEFAULT_CLOUD_API_BASE_URL);
  });

  it('null/undefined fallback 默认', () => {
    setCloudApiBaseUrl(null);
    expect(getCloudApiBaseUrl()).toBe(DEFAULT_CLOUD_API_BASE_URL);
    setCloudApiBaseUrl(undefined);
    expect(getCloudApiBaseUrl()).toBe(DEFAULT_CLOUD_API_BASE_URL);
  });

  it('仅含空白也 fallback 默认', () => {
    setCloudApiBaseUrl('   ');
    expect(getCloudApiBaseUrl()).toBe(DEFAULT_CLOUD_API_BASE_URL);
  });

  it('自定义值立即生效', () => {
    setCloudApiBaseUrl('https://custom.example.com/api');
    expect(getCloudApiBaseUrl()).toBe('https://custom.example.com/api');
  });
});

describe('B1: buildBilibiliApiCall 行为', () => {
  beforeEach(() => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({ data: { code: 0, data: { ok: 1 } } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('code===0 时 resolve 内层 data', async () => {
    const call = buildBilibiliApiCall<{ ok: number }>({ url: '/x' });
    const out = await call();
    expect(out).toEqual({ ok: 1 });
  });

  it('useWbi=true 在请求 config 中标记 __useWbi', async () => {
    const spy = bilibiliPure.request as unknown as ReturnType<typeof vi.fn>;
    const call = buildBilibiliApiCall({ url: '/wbi/x', useWbi: true });
    await call({ params: { foo: 'bar' } });

    const arg = spy.mock.calls[0][0];
    expect(arg.__useWbi).toBe(true);
    expect(arg.url).toBe('/wbi/x');
    expect(arg.params).toEqual({ foo: 'bar' });
  });

  it('未声明 useWbi 时 __useWbi 为 undefined', async () => {
    const spy = bilibiliPure.request as unknown as ReturnType<typeof vi.fn>;
    const call = buildBilibiliApiCall({ url: '/x' });
    await call();
    expect(spy.mock.calls[0][0].__useWbi).toBeUndefined();
  });

  it('responseType=blob 时直接返回原始 data 不做 code 拆包', async () => {
    const blob = new Blob(['x']);
    (bilibiliPure.request as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: blob,
    });
    const call = buildBilibiliApiCall<Blob>({ url: '/blob' });
    const out = await call({ responseType: 'blob' });
    expect(out).toBe(blob);
  });

  it('code 非 0 时 throw 整个 respData', async () => {
    (bilibiliPure.request as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { code: -1, message: 'bad' },
    });
    const call = buildBilibiliApiCall({ url: '/bad' });
    await expect(call()).rejects.toMatchObject({ code: -1, message: 'bad' });
  });

  // setWbiInfo 仅作可调用性自检（具体签名注入由 wbi.test.ts 覆盖）
  it('setWbiInfo 不抛错', () => {
    expect(() => setWbiInfo({ img_key: 'a'.repeat(32), sub_key: 'b'.repeat(32) })).not.toThrow();
  });
});

describe('B2: buildCloudApiCall 行为', () => {
  beforeEach(() => {
    vi.spyOn(cloudPure, 'request').mockResolvedValue({ data: { code: 0, data: { id: 1 } } });
    setCloudServiceToken('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('code===0 时 resolve 内层 data', async () => {
    const call = buildCloudApiCall<{ id: number }>({ url: '/foo' });
    const out = await call();
    expect(out).toEqual({ id: 1 });
  });

  it('SESSION_EXPIRED_ERROR_CODES 命中时调用 sessionExpiredHandler 后 throw', async () => {
    (cloudPure.request as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { code: 4010000, message: 'token 失效' },
    });

    const handler = vi.fn();
    setSessionExpiredHandler(handler);

    const call = buildCloudApiCall({ url: '/foo' });
    await expect(call()).rejects.toMatchObject({ code: 4010000 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ code: 4010000 });
  });

  it.each([4010001, 4010003, 4010006])('错误码 %i 也触发会话失效', async (code) => {
    (cloudPure.request as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { code, message: 'expired' },
    });
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    await expect(buildCloudApiCall({ url: '/x' })()).rejects.toBeDefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('非会话失效错误码不调用 handler', async () => {
    (cloudPure.request as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { code: 4000001, message: 'bad request' },
    });
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    await expect(buildCloudApiCall({ url: '/x' })()).rejects.toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('responseType=arraybuffer 直接返回 data 不拆包', async () => {
    const buf = new ArrayBuffer(8);
    (cloudPure.request as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: buf,
    });
    const out = await buildCloudApiCall<ArrayBuffer>({ url: '/x' })({
      responseType: 'arraybuffer',
    });
    expect(out).toBe(buf);
  });
});

/**
 * A8: 错误码 fallback 路径
 *
 * 覆盖 client.ts 中两层 fallback：
 * 1. cloudService 响应拦截器：网络异常时把 error 转成 `{ code: -1, message: '网络异常，请重试' }`
 *    使调用方拿到统一形状而不是 axios 原生 AxiosError
 * 2. buildCloudApiCall：响应缺 code 字段、未知 code、非会话失效 code 时一律透传 throw，
 *    由 UI 决定 message 展示策略（client 不内置错误码到 message 的字典）
 */
describe('A8: 云服务错误码 fallback', () => {
  beforeEach(() => {
    setCloudServiceToken('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('网络异常 fallback：拦截器 catch 后 buildCloudApiCall 拒绝（含 code=-1 与中文文案）', async () => {
    // 模拟拦截器 catch 后把 error 转成 fallback 对象的形状
    vi.spyOn(cloudPure, 'request').mockResolvedValueOnce({
      data: { code: -1, message: '网络异常，请重试' },
    });
    const call = buildCloudApiCall({ url: '/network-fail' });
    await expect(call()).rejects.toMatchObject({
      code: -1,
      message: '网络异常，请重试',
    });
  });

  it('真实拦截器：axios adapter 抛错时 response interceptor 把 error 转成 fallback', async () => {
    const originalAdapter = cloudPure.defaults.adapter;
    cloudPure.defaults.adapter = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    try {
      const call = buildCloudApiCall({ url: '/network-down' });
      await expect(call()).rejects.toMatchObject({
        code: -1,
        message: '网络异常，请重试',
      });
    } finally {
      cloudPure.defaults.adapter = originalAdapter;
    }
  });

  it('响应缺 code 字段时直接 throw 整个 respData（不会误判为 code===0）', async () => {
    vi.spyOn(cloudPure, 'request').mockResolvedValueOnce({
      data: { unexpected: 'shape' },
    });
    const call = buildCloudApiCall({ url: '/malformed' });
    await expect(call()).rejects.toMatchObject({ unexpected: 'shape' });
  });

  it('未知错误码（非 0、非会话失效）：透传 throw，session handler 不触发', async () => {
    vi.spyOn(cloudPure, 'request').mockResolvedValueOnce({
      data: { code: 9999999, message: 'totally new error' },
    });
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    await expect(buildCloudApiCall({ url: '/unknown' })()).rejects.toMatchObject({
      code: 9999999,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('code 类型为 string 时不命中 SESSION_EXPIRED_CODES（typeof 检查防御）', async () => {
    vi.spyOn(cloudPure, 'request').mockResolvedValueOnce({
      data: { code: '4010000', message: 'string typed code' },
    });
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    await expect(buildCloudApiCall({ url: '/string-code' })()).rejects.toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });
});
