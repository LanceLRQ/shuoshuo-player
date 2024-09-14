import axios from 'axios';
import qs from 'qs';
import {encWbi} from "@/api/utils";

const service = axios.create({
    timeout: 30000,
    withCredentials: true, // 启用跨域请求时携带 cookie
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    baseURL: '/',
});

service.interceptors.request.use(function (config) {
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

export const pureApiCall = service;

export const apiCall = (config) => {
    const options = {
        method: 'get',
        withCredentials: true,
        useWbi: false,
        ...config,
    };

    return new Promise((resolve, reject) => {
        service(options).then(function (resp) {
            if (config.responseType === 'blob') {
                resolve(resp);
            } else {
                const respData = resp.data || {};
                const suc = respData.code === 0;
                if (suc) {
                    resolve(respData.data);
                } else {
                    reject(respData.data, respData);
                }
            }
        }).catch(e => {
            console.error('[DEBUG]' + e);
            reject(null, {code: -1, message: '网络异常，请重试'})
        })
    })
};

export const buildApiCall = (config) => ({...args}={}) => apiCall({...config, ...args});
export const buildPureApiCall = (config) => ({...args}={}) => pureApiCall({...config, ...args});
