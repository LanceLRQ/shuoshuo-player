import {buildApiCall} from "@/api/axios";

const Lyric = {
    getLyricByBvid: (bvid) => buildApiCall({
        url: `/lyric/${bvid}`,
    }),
    saveLyric: (bvid) => buildApiCall({
        url: `/lyric/manage/${bvid}`,
        method: 'post',
    }),
    getLyricList: buildApiCall({
        url: `/lyric/manage/list`,
    }),
    getLyricHistory: (bvid) => buildApiCall({
        url: `/lyric/manage/${bvid}/snap`,
    }),
    deleteLyric: (bvid) => buildApiCall({
        url: `/lyric/manage/${bvid}`,
        method: 'delete'
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
    changePassword: buildApiCall({
        url: '/accounts/password',
        method: 'post',
    }),


    Manage: {
        getAccountsList: buildApiCall({
            url: '/accounts/list',
            method: 'get',
        }),
        getAccount: (id) => buildApiCall({
            url: `/accounts/${id}`,
            method: 'get',
        }),
        addAccount: buildApiCall({
            url: `/accounts`,
            method: 'post',
        }),
        editAccount: (id) => buildApiCall({
            url: `/accounts/${id}`,
            method: 'put',
        }),
        deleteAccount: (id) => buildApiCall({
            url: `/accounts/${id}`,
            method: 'edit',
        }),
    }
}

export const api = {
    Lyric,
    Account
}

export default api;