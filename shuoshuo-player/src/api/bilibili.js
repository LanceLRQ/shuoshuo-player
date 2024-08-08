import {buildApiCall} from "@/api/axios";

const UserApi = {
    getUserInfo: buildApiCall({
        url: '/x/web-interface/nav',
    }),
    getUserVideoList: buildApiCall({
        // https://github.com/SocialSisterYi/bilibili-API-collect/blob/cb4f767d4ee3f4f66b6caff04c9c40164ea4af54/docs/user/space.md#%E6%8A%95%E7%A8%BF
        url: '/x/space/wbi/arc/search',
    })
}

const api = {
    UserApi
}

export default api;