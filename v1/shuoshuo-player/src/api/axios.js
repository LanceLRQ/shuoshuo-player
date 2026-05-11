import axios from 'axios';
import qs from 'qs';
import {encWbi} from "@/api/utils";

const bilibiliService = axios.create({
    timeout: 30000,
    withCredentials: true, // 启用跨域请求时携带 cookie
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    baseURL: '/',
});

let apiBase = process.env.NODE_ENV === 'development' ? 'http://localhost:10715/api' : 'https://player.ss.sikong.ren/api';
if (process.env.REACT_APP_API_MODE === 'production') {
    apiBase = 'https://player.ss.sikong.ren/api';
}

const cloudService = axios.create({
    timeout: 10000,
    withCredentials: true,
    headers: {'Content-Type': 'application/json'},
    baseURL: apiBase,
});

bilibiliService.interceptors.request.use(function (config) {
    let {data, method, useWbi = false} = config;
    if (useWbi && window.BILIBILI_WBI_INFO) {
        config.params = encWbi(config.params, window.BILIBILI_WBI_INFO.img_key, window.BILIBILI_WBI_INFO.sub_key)
    }
    const noParse = (typeof data === "string" || data instanceof FormData);
    if (method === 'post' && !noParse) config.data = qs.stringify(data);
    return config;
}, function (error) {
    return Promise.reject(error);
});

// 添加响应拦截器
cloudService.interceptors.response.use(
    response => {
        // 对2xx范围内的状态码直接返回
        return response;
    },
    error => {
        // 对非2xx的状态码处理
        if (error.response) {
            // 服务器返回了响应，可以访问error.response
            return Promise.resolve(error.response);
        } else {
            // 请求未发出或未收到响应
            return Promise.reject(error);
        }
    }
);

export const pureBilibiliApiCall = bilibiliService;
export const bilibiliApiCall = (config) => {
    const options = {
        method: 'get',
        withCredentials: true,
        useWbi: false,
        ...config,
    };

    return new Promise((resolve, reject) => {
        bilibiliService(options).then( (resp) => {
            if (config.responseType === 'blob') {
                resolve(resp);
            } else {
                const respData = resp.data || {};
                const suc = respData.code === 0;
                if (suc) {
                    resolve(respData.data);
                } else {
                    reject(respData);
                }
            }
        }).catch(e => {
            console.debug('[DEBUG]', e);
            reject({code: -1, message: '网络异常，请重试'})
        })
    })
};

export const pureApiCall = cloudService;
export const apiCall = (config) => {
    const options = {
        method: 'get',
        withCredentials: true,
        ...config,
    };

    if (window.CLOUD_SERVICE_SESSION) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = window.CLOUD_SERVICE_SESSION?.token;
    }

    return new Promise((resolve, reject) => {
        cloudService(options).then(function (resp) {
            if (config.responseType === 'blob') {
                resolve(resp);
            } else {
                const respData = resp.data || {};
                const suc = !respData.code && !respData.errno;
                if (suc) {
                    resolve(respData.data);
                } else if (respData.code === 401 || respData.errno === 4010000) {
                    window.SHOW_CLOUD_LOGIN && window.SHOW_CLOUD_LOGIN();
                    console.error('[error]登录信息已失效');
                    window.__PLAYER_STORE.dispatch({type: 'cloud_service/clearSession'})
                    reject(respData);
                } else {
                    reject(respData);
                }
            }
        }).catch(e => {
            console.debug('[DEBUG]', e);
            reject( {code: -1, errno: -1, message: '网络异常，请重试'})
        })
    })
};

export const buildApiBilibiliCall = (config) => ({...args}={}) => bilibiliApiCall({...config, ...args});
export const buildPureBilibiliApiCall = (config) => ({...args}={}) => pureBilibiliApiCall({...config, ...args});

export const buildApiCall = (config) => ({...args}={}) => apiCall({...config, ...args});
export const buildPureApiCall = (config) => ({...args}={}) => pureApiCall({...config, ...args});
