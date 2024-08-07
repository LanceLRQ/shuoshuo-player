import {buildApiCall} from "@/api/axios";

const UserApi = {
    getUserInfo: buildApiCall({
        url: '/x/web-interface/nav',
    })
}

const api = {
    UserApi
}

export default api;