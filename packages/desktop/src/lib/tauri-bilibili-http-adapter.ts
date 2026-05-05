import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * Tauri 端 B 站 API axios adapter
 *
 * 替换 axios 默认 (XHR/fetch) adapter。底层走 @tauri-apps/plugin-http 的 fetch，
 * 由 Rust reqwest 发起 HTTP，绕开 WebView CORS（http://localhost:1420 → api.bilibili.com）。
 *
 * 与 Chrome 扩展 rules.json + host_permissions 等价的功能：
 * - Referer / User-Agent 注入：替代 DNR 的 modifyHeaders 规则
 * - Cookie：从 Rust CookieState 读取（含 HttpOnly 的 SESSDATA），手动拼 Cookie header
 *   （reqwest cookie store 与 webview cookie store 隔离，必须显式注入）
 *
 * 假设条件（由 axios request interceptor 保证）：
 * - WBI 签名参数已合并到 config.params
 * - POST body 已被 qs.stringify 转为 form-urlencoded 字符串
 * - Content-Type 已设置（默认 application/x-www-form-urlencoded）
 */

const BILIBILI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const BILIBILI_REFERER = 'https://www.bilibili.com/';

/** 生成 Tauri B 站 axios adapter 实例（注入 Cookie/Referer/Origin/UA） */
export function createTauriBilibiliHttpAdapter(): AxiosAdapter {
  return makeAdapter({ kind: 'bilibili' });
}

/**
 * 生成 Tauri 云服务 axios adapter 实例（仅透传，不注入 bilibili 反爬 headers）
 *
 * 仍走 plugin-http 绕过 WebView CORS（云服务后端未配 Allow-Origin），
 * 但不调 invoke('get_bilibili_cookies') 也不加 bilibili Referer/Origin/UA。
 * Authorization / Content-Type 等 cloud 自身需要的 header 由 axios 拦截器
 * 已设置，本 adapter 完全透传。
 */
export function createTauriCloudHttpAdapter(): AxiosAdapter {
  return makeAdapter({ kind: 'cloud' });
}

interface AdapterOptions {
  kind: 'bilibili' | 'cloud';
}

function makeAdapter(opts: AdapterOptions): AxiosAdapter {
  const tag = opts.kind === 'bilibili' ? 'TauriBilibiliHttpAdapter' : 'TauriCloudHttpAdapter';
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const url = buildUrl(config);
    const cookieHeader = opts.kind === 'bilibili' ? await loadCookieHeader() : '';
    const headers = buildHeaders(config, cookieHeader, opts.kind);
    const body = buildBody(config);

    const fetchInit: RequestInit = {
      method: (config.method ?? 'get').toUpperCase(),
      headers,
    };
    if (body !== undefined && fetchInit.method !== 'GET' && fetchInit.method !== 'HEAD') {
      fetchInit.body = body;
    }

    if (opts.kind === 'bilibili') {
      const cookieKeys = cookieHeader
        ? cookieHeader
            .split(';')
            .map((c) => c.trim().split('=')[0])
            .filter(Boolean)
        : [];
      console.info(
        `[${tag}] fetch`,
        url,
        'method=',
        fetchInit.method,
        'cookieLen=',
        cookieHeader.length,
        'cookieKeys=',
        cookieKeys.join(','),
      );
    } else {
      console.info(`[${tag}] fetch`, url, 'method=', fetchInit.method);
    }

    const response = await tauriFetch(url, fetchInit);
    console.info(`[${tag}] response`, url, 'status=', response.status);

    if (response.status >= 400) {
      const cloned = response.clone();
      try {
        const errBody = await cloned.text();
        console.error(`[${tag}] error body`, errBody.slice(0, 500));
      } catch {
        /* noop */
      }
    }
    const data = await parseResponseBody(response, config.responseType);

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: serializeResponseHeaders(response.headers),
      config,
      request: undefined,
    };
  };
}

function buildUrl(config: InternalAxiosRequestConfig): string {
  const base = config.url ?? '';
  if (!config.params) return base;
  // B 站 API 的 params 均为扁平 key/value（含 WBI 签名后的 w_rid / wts），
  // URLSearchParams 已足够；与 qs.stringify 默认行为兼容
  const usp = new URLSearchParams();
  const params = config.params as Record<string, unknown>;
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    usp.append(key, String(value));
  }
  const query = usp.toString();
  if (!query) return base;
  return base.includes('?') ? `${base}&${query}` : `${base}?${query}`;
}

async function loadCookieHeader(): Promise<string> {
  try {
    return await invoke<string>('get_bilibili_cookies');
  } catch (err) {
    console.warn('[TauriBilibiliHttpAdapter] get_bilibili_cookies failed', err);
    return '';
  }
}

function buildHeaders(
  config: InternalAxiosRequestConfig,
  cookieHeader: string,
  kind: AdapterOptions['kind'],
): Headers {
  const headers = new Headers();
  // axios headers 是 AxiosHeaders（类 Map）；用 forEach 兼容 plain object 与 AxiosHeaders 两种形态
  const raw = config.headers as unknown;
  const hasForEach = (
    v: unknown,
  ): v is { forEach: (cb: (value: string, key: string) => void) => void } =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { forEach?: unknown }).forEach === 'function';
  if (hasForEach(raw)) {
    raw.forEach((value, key) => {
      if (value !== undefined && value !== null && value !== '') {
        headers.set(key, String(value));
      }
    });
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value !== undefined && value !== null && value !== '') {
        headers.set(key, String(value));
      }
    }
  }
  if (kind === 'bilibili') {
    headers.set('Referer', BILIBILI_REFERER);
    // Origin 显式设为 bilibili 主域，否则 plugin-http 默认带 tauri://localhost / null，
    // 触发 B 站反爬（403）。Chrome 扩展靠 host_permissions 自动设置 Origin，Tauri 必须手动。
    headers.set('Origin', 'https://www.bilibili.com');
    headers.set('User-Agent', BILIBILI_UA);
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }
  }
  return headers;
}

function buildBody(config: InternalAxiosRequestConfig): BodyInit | undefined {
  const data = config.data;
  if (data === undefined || data === null) return undefined;
  if (typeof data === 'string') return data;
  if (data instanceof FormData || data instanceof URLSearchParams || data instanceof Blob) {
    return data;
  }
  // 兜底：未被拦截器处理的对象 fallback 到 JSON
  return JSON.stringify(data);
}

async function parseResponseBody(
  response: Response,
  responseType: InternalAxiosRequestConfig['responseType'],
): Promise<unknown> {
  switch (responseType) {
    case 'arraybuffer':
      return await response.arrayBuffer();
    case 'blob':
      return await response.blob();
    case 'text':
      return await response.text();
    case 'stream':
      return response.body;
    default: {
      // 默认 / 'json'：buildBilibiliApiCall 期望 resp.data 是 JSON 对象
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
}

function serializeResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
