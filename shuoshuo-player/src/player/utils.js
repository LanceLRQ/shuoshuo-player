import API from '../api';
import {BilibiliUserInfoReducer} from "@/store/profile";

export const initUserInfo = async (dispatch) => {

    try {
        const userData = await API.Bilibili.UserApi.getUserInfo();
        dispatch(BilibiliUserInfoReducer.actions.updateUserInfo(userData));
    } catch (e) {}
}