const {ipcMain} = require("electron");

const qs = require('qs');
const axios = require('axios');
const lodash = require('lodash');

const QQMusicClient = axios.create({
    timeout: 5000, // 设置超时时间
});

const NetEaseMusicClient = axios.create({
    baseURL: 'https://music.163.com',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded', // 设置默认请求头
    },
    timeout: 5000, // 设置超时时间
});

NetEaseMusicClient.interceptors.request.use(config => {
    if (config.data && config.method === 'post') {
        config.data = qs.stringify(config.data);
    }
    return config;
}, error => {
    return Promise.reject(error);
});

const SearchMusicInfoFromQQMusic = async (keyword, limit = 10) => {
    if (!keyword) return [];
    const payloads = {
        "comm" : {
            "_channelid" : "0",
            "_os_version" : "6.1.7601-2%2C+Service+Pack+1",
            "authst" : "",
            "ct" : "19",
            "cv" : "1873",
            "guid" : "",
            "patch" : "118",
            "psrf_access_token_expiresAt" : 0,
            "psrf_qqaccess_token" : "",
            "psrf_qqopenid" : "",
            "psrf_qqunionid" : "",
            "tmeAppID" : "qqmusic",
            "tmeLoginType" : 2,
            "uin" : "0",
            "wid" : "0"
        },
        "music.search.SearchCgiService" : {
            "method" : "DoSearchForQQMusicDesktop",
            "module" : "music.search.SearchCgiService",
            "param" : {
                "grp" : 1,
                "num_per_page" : limit,
                "page_num" : 1,
                "query" : keyword,
                "remoteplace" : "txt.newclient.top",
                "search_type" : 0,
                "searchid" : ""
            }
        }
    }
    const res = await QQMusicClient({
        method: 'post',
        url: 'https://u.y.qq.com/cgi-bin/musicu.fcg' ,
        headers: {
            'Host': 'u.y.qq.com',
            'Content-Type': 'application/json', // 设置默认请求头
            'Referer': 'https://y.qq.com/n/ryqq/player',
            'Origin': 'https://y.qq.com',
        },
        params: {
            pcachetime: Date.now(),
        },
        data: payloads,
    });
    const resData = res.data;
    if (!resData) return [];
    return lodash.get(resData['music.search.SearchCgiService'], 'data.body.song.list', [])
}

const GetLyricFromQQMusic = async (songMid) => {
    if (!songMid) return null;
    const res = await QQMusicClient({
        method: 'get',
        url: 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg' ,
        params: {
            songmid: songMid,
        },
        headers: {
            'Origin': 'https://y.qq.com/',
            'Referer': 'https://y.qq.com/',
        }
    });
    const resData = res.data;
    try {
        const parsedData = JSON.parse(resData.replace(/^MusicJsonCallback\(/, '').replace(/\);?$/, ''));
        const lrcBase64 = lodash.get(parsedData, 'lyric', '');
        return decodeURIComponent(escape(atob(lrcBase64)));
    } catch (e) {
        return null;
    }
}

// 网抑云要登录。。pass
const SearchMusicInfoFromNetEaseMusic = async (keyword, limit = 10) => {
    const res = await NetEaseMusicClient({
        method: 'post',
        url: '/api/search/pc' ,
        data: {
            "s": keyword,
            "offset": "0",
            "limit": limit,
            "type": "1"
        },
    });
    const resData = res.data;
    if (!resData) return [];
    return lodash.get(resData, 'result.songs', [])
}

const GetLyricFromNetEaseMusic = async (id) => {
    const res = await NetEaseMusicClient({
        method: 'post',
        url: '/api/song/lyric' ,
        data: {
            "os": 'pc',
            "id": id,
            "lv": "-1",
            "kv": "-1",
            "tv": "-1",
        },
    });
    const resData = res.data;
    if (!resData) return '';
    return lodash.get(resData, 'lrc.lyric',  '')
}

export const BindElectronAPI = () => {
    ipcMain.handle('spider:qqmusic:search', async (event, keyword, limit) => {
        console.log(keyword, limit);
        return await SearchMusicInfoFromQQMusic(keyword, limit);
    });
    ipcMain.handle('spider:qqmusic:get_lrc', async (event, mid) => {
        return await GetLyricFromQQMusic(mid);
    });
}

// SearchMusicInfoFromQQMusic('如愿').then((res) => {
//     const mid = lodash.get(res, '[0].mid', '');
//     GetLyricFromQQMusic(mid).then((res) => {
//         console.log(res);
//     });
// })

// SearchMusicInfoFromNetEaseMusic('如愿').then((res) => {
//     console.log(res);
// });