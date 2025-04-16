import {buildApiCall} from "@/api/axios";

const Lyric = {
    getLyricByBvid: (bvid) => buildApiCall({
        url: `/lyric/${bvid}`,
    }),
    saveLyric: (bvid) => buildApiCall({
        url: `/lyric/manage/${bvid}`,
        method: 'post',
    }),
}

const Account = {
    login: buildApiCall({
        url: '/login',
        method: 'post',
    }),
    checkLogin: buildApiCall({
        url: '/login',
        method: 'get',
    }),
    getAccountsList: buildApiCall({
        url: '/accounts/list',
        method: 'get',
    }),
}

export const api = {
    Lyric,
    Account
}

export default api;