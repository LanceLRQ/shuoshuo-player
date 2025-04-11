import {buildApiCall} from "@/api/axios";

const Lyric = {
    getLyricByBvid: (bvid) => buildApiCall({
        url: `/lyric/${bvid}`,
    }),
}

const Account = {
    login: buildApiCall({
        url: '/login',
        method: 'post',
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