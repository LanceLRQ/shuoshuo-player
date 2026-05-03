import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import qs from 'qs';
import { encWbi } from './bilibili/wbi';
import {
  DEFAULT_CLOUD_API_BASE_URL,
  CLOUD_API_BASE_URL_STORAGE_KEY,
  SESSION_EXPIRED_ERROR_CODES,
} from '../constants';
import type { CloudErrorResponse, WbiInfo } from '../types';
import { triggerWbiRefresh } from './wbi-refresh';

/* ========== WBI 密钥（写入即热更新，请求拦截器读取最新值） ========== */

let wbiInfo: WbiInfo | null = null;

export function setWbiInfo(info: WbiInfo) {
  wbiInfo = info;
  if (__DEV_LOG__) console.debug('[WBI-DEBUG] setWbiInfo', info);
}

export function getWbiInfo(): WbiInfo | null {
  return wbiInfo;
}

/* ========== 云服务全局配置：Token + 动态 baseURL ========== */

let cloudServiceToken = '';

export function setCloudServiceToken(token: string) {
  cloudServiceToken = token;
}

let cloudApiBaseUrl = DEFAULT_CLOUD_API_BASE_URL;

/** 设置云服务 baseURL（持久化由调用方负责） */
export function setCloudApiBaseUrl(url: string | null | undefined) {
  cloudApiBaseUrl = (url && url.trim()) || DEFAULT_CLOUD_API_BASE_URL;
}

export function getCloudApiBaseUrl(): string {
  return cloudApiBaseUrl;
}

export { CLOUD_API_BASE_URL_STORAGE_KEY };

/* ========== 401 / 会话失效回调钩子 ========== */

type SessionExpiredHandler = (resp: CloudErrorResponse) => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler) {
  sessionExpiredHandler = handler;
}

const SESSION_EXPIRED_CODES: ReadonlySet<number> = new Set<number>(SESSION_EXPIRED_ERROR_CODES);

/* ========== Bilibili API 实例 ========== */

/** 自定义请求配置：携带 __useWbi 标记由拦截器消费 */
type RequestConfigWithWbi = AxiosRequestConfig & { __useWbi?: boolean };
type InternalRequestConfigWithWbi = InternalAxiosRequestConfig & { __useWbi?: boolean };

export const bilibiliService: AxiosInstance = axios.create({
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// 响应拦截器：dev 模式打印网络层错误（超时、4xx、5xx、CORS、断网），定位"接口不可用"现象
bilibiliService.interceptors.response.use(
  (resp) => resp,
  (err: { config?: { url?: string }; message?: string; response?: { status?: number } }) => {
    if (__DEV_LOG__) {
      console.debug(
        '[BILI-API] network error:',
        err?.config?.url,
        'status=',
        err?.response?.status,
        'msg=',
        err?.message,
      );
    }
    return Promise.reject(err);
  },
);

bilibiliService.interceptors.request.use(async (config) => {
  const cfg = config as InternalRequestConfigWithWbi;
  // 进入 wbi 接口前确保密钥新鲜（>20 分钟才真正调 nav，否则立即返回）
  if (cfg.__useWbi) {
    try {
      await triggerWbiRefresh();
    } catch {
      // nav 失败时仍允许用旧密钥继续签名（拿不到新 key 总比不签强）
    }
  }
  if (__DEV_LOG__) {
    console.debug('[WBI-DEBUG] interceptor entry', {
      url: cfg.url,
      method: cfg.method,
      __useWbi: cfg.__useWbi,
      wbiInfo,
      paramsBefore: cfg.params,
    });
  }
  if (cfg.__useWbi && wbiInfo) {
    cfg.params = encWbi(
      (cfg.params as Record<string, unknown> | undefined) ?? {},
      wbiInfo.img_key,
      wbiInfo.sub_key,
    );
    if (__DEV_LOG__) {
      console.debug('[WBI-DEBUG] params after encWbi', {
        url: cfg.url,
        paramsAfter: cfg.params,
      });
    }
  } else if (__DEV_LOG__) {
    console.debug('[WBI-DEBUG] skip signing', {
      url: cfg.url,
      reason: !cfg.__useWbi ? '__useWbi=false' : 'wbiInfo=null',
    });
  }
  if (cfg.method?.toLowerCase() === 'post' && cfg.data && typeof cfg.data === 'object') {
    cfg.data = qs.stringify(cfg.data as Record<string, unknown>);
  }
  return cfg;
});

/* ========== 云服务 API 实例（动态 baseURL） ========== */

export const cloudService: AxiosInstance = axios.create({
  timeout: 10000,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

cloudService.interceptors.request.use((config) => {
  // 每次请求重新读取 baseURL，确保用户改设置后立即生效
  config.baseURL = cloudApiBaseUrl;
  if (cloudServiceToken) {
    config.headers.Authorization = `Bearer ${cloudServiceToken}`;
  }
  return config;
});

cloudService.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.resolve(
      (error as { response?: { data: unknown } }).response ?? {
        data: { code: -1, message: '网络异常，请重试' } satisfies CloudErrorResponse,
      },
    ),
);

/* ========== 调用包装器 ========== */

/**
 * 调用层运行时配置；params/data 用 object 而非 Record，
 * 以便业务侧的 interface（如 LyricListParams）可直接传入而不需要索引签名
 */
export interface RuntimeRequestConfig {
  params?: object;
  data?: object;
  responseType?: AxiosRequestConfig['responseType'];
}

/** 构建 Bilibili API 调用 */
export function buildBilibiliApiCall<TData = unknown>(config: {
  url: string;
  method?: string;
  useWbi?: boolean;
}) {
  return async (runtimeConfig?: RuntimeRequestConfig): Promise<TData> => {
    const requestConfig: RequestConfigWithWbi = {
      url: config.url,
      method: config.method || 'get',
      params: runtimeConfig?.params,
      data: runtimeConfig?.data,
      responseType: runtimeConfig?.responseType,
      __useWbi: config.useWbi,
    };
    const resp = await bilibiliService.request(requestConfig);

    if (runtimeConfig?.responseType === 'blob' || runtimeConfig?.responseType === 'arraybuffer') {
      return resp.data as TData;
    }

    const respData = resp.data as { code?: number; data?: TData } & CloudErrorResponse;
    if (respData?.code === 0) {
      return respData.data as TData;
    }
    if (__DEV_LOG__) {
      console.debug(
        '[BILI-API] non-zero code:',
        config.url,
        'code=',
        respData?.code,
        'message=',
        respData?.message,
        'full=',
        respData,
      );
    }
    throw respData;
  };
}

/** 构建云服务 API 调用 */
export function buildCloudApiCall<TData = unknown>(config: { url: string; method?: string }) {
  return async (runtimeConfig?: RuntimeRequestConfig): Promise<TData> => {
    const resp = await cloudService.request({
      url: config.url,
      method: config.method || 'get',
      params: runtimeConfig?.params,
      data: runtimeConfig?.data,
      responseType: runtimeConfig?.responseType,
    });

    if (runtimeConfig?.responseType === 'blob' || runtimeConfig?.responseType === 'arraybuffer') {
      return resp.data as TData;
    }

    const respData = resp.data as { code?: number; data?: TData } & CloudErrorResponse;
    if (respData?.code === 0) {
      return (respData.data ?? (respData as unknown)) as TData;
    }
    if (typeof respData?.code === 'number' && SESSION_EXPIRED_CODES.has(respData.code)) {
      sessionExpiredHandler?.(respData);
    }
    throw respData;
  };
}

/* ========== 暴露原始实例供特殊场景使用（v1 pureBilibiliApiCall / pureApiCall 等价） ========== */

export const bilibiliPure = bilibiliService;
export const cloudPure = cloudService;
