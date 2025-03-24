const qs = require('qs');
const axios = require('axios');
const lodash = require('lodash');

const SSPlayerAPIClient = axios.create({
    baseURL: process.env.NODE_ENV === 'development' ? 'http://localhost:10715/api' : 'https://shuoshuo.sikong.ren/shuoshuo-player/api',
    timeout: 5000, // 设置超时时间
});

// TODO 云服务