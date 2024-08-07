import axios from 'axios';
import qs from 'qs';

const service = axios.create({
    timeout: 30000,
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    baseURL: 'https://api.bilibili.com/',
});

service.interceptors.request.use(function (config) {
    let {data, method} = config;
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
            reject(null, {code: -1, message: '网络异常，请重试'})
        })
    })
};

export const buildApiCall = (config) => ({...args}={}) => apiCall({...config, ...args});
export const buildPureApiCall = (config) => ({...args}={}) => pureApiCall({...config, ...args});
