import {buildApiCall} from "@/api/axios";

const UserApi = {
    getUserInfo: buildApiCall({
        // https://github.com/SocialSisterYi/bilibili-API-collect/blob/cb4f767d4ee3f4f66b6caff04c9c40164ea4af54/docs/login/login_info.md
        url: 'https://api.bilibili.com/x/web-interface/nav',
    }),
    getUserVideoList: buildApiCall({
        // https://github.com/SocialSisterYi/bilibili-API-collect/blob/cb4f767d4ee3f4f66b6caff04c9c40164ea4af54/docs/user/space.md#%E6%8A%95%E7%A8%BF
        // 需要设置referrer (已经在background.js处理)
        url: 'https://api.bilibili.com/x/space/wbi/arc/search',
        useWbi: true,
    }),
    getUserSpaceInfo: buildApiCall({
        url: 'https://api.bilibili.com/x/space/wbi/acc/info',
        useWbi: true,
    }),
    getUserSpaceStat: buildApiCall({        // 关注、粉丝数
        url: 'https://api.bilibili.com/x/relation/stat',
        useWbi: true,
    }),
    getUserSpaceUpStat: buildApiCall({        // 获赞、播放
        url: 'https://api.bilibili.com/x/space/upstat',
    })
}
const VideoApi = {
    getVideoViewInfo: buildApiCall({
        // https://github.com/SocialSisterYi/bilibili-API-collect/blob/cb4f767d4ee3f4f66b6caff04c9c40164ea4af54/docs/video/info.md
        url: 'https://api.bilibili.com/x/web-interface/view',
    }),
    getVideoPlayurl: buildApiCall({
        // https://github.com/SocialSisterYi/bilibili-API-collect/blob/cb4f767d4ee3f4f66b6caff04c9c40164ea4af54/docs/video/videostream_url.md
        url: 'https://api.bilibili.com/x/player/wbi/playurl',
        useWbi: true,
    }),
    doClickStat: buildApiCall({
        method: 'post',
        url: 'https://api.bilibili.com/x/click-interface/click/web/h5',
        useWbi: true,
    }),
    searchVideo: buildApiCall({
        method: 'get',
        url: 'https://api.bilibili.com/x/web-interface/search/type',
    })
}

const api = {
    UserApi,
    VideoApi
}

export default api;