import axios from 'axios';
import lodash from 'lodash';

const QQMusicClient = axios.create({
    timeout: 5000, // 设置超时时间
});

export const SearchMusicInfoFromQQMusic = async (keyword, limit = 10) => {
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
            'Content-Type': 'application/json', // 设置默认请求头
            'Referer': 'https://y.qq.com/n/ryqq/player',
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

export const GetLyricFromQQMusic = async (songMid) => {
    if (!songMid) return null;
    const res = await QQMusicClient({
        method: 'get',
        url: 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg' ,
        params: {
            songmid: songMid,
        },
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
