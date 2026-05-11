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

const LiveSlicerMen = {
    getLiveSlicerMenList: buildApiCall({
        url: `/live_slicer_men/list`,
    }),
    updateLiveSlicerMan: (id) => buildApiCall({
        url: `/live_slicer_men/manage/${id}`,  // 以mid区别，Post时传入会自动更新，传数据记录id也能识别
        method: 'post',
    }),
    deleteLiveSlicerMan: (id) => buildApiCall({
        url: `/live_slicer_men/manage/${id}`,
        method: 'delete'
    }),
}


export const api = {
    Lyric,
    Account,
    LiveSlicerMen
}

export default api;