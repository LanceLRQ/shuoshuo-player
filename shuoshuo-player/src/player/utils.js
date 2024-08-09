import API from '../api';
import { BilibiliUserInfoReducer } from "@/store/profile";
import { BilibiliUserVideoListReducer } from "@/store/caches";

// 读取当前登录用户的信息
export const initUserInfo = async (dispatch) => {
    try {
        const userData = await API.Bilibili.UserApi.getUserInfo();
        dispatch(BilibiliUserInfoReducer.actions.updateUserInfo(userData));
        const { wbi_img: { img_url, sub_url } } = userData;
        window.BILIBILI_WBI_INFO = {   // 写入wbi信息到全局
            img_key: img_url.slice(
                img_url.lastIndexOf('/') + 1,
                img_url.lastIndexOf('.')
            ),
            sub_key: sub_url.slice(
                sub_url.lastIndexOf('/') + 1,
                sub_url.lastIndexOf('.')
            )
        }
    } catch (e) {}
}

// 读取用户的视频投稿信息（前30）
export const readUserVideos = async (dispatch, mid, query) => {
    try {
        if (!mid) return;
        const videoData = await API.Bilibili.UserApi.getUserVideoList({
            params: {
                mid,
                ...query,
            }
        });
        dispatch(BilibiliUserVideoListReducer.actions.updateVideoList({
            mid, data: videoData
        }));
    } catch (e) {}
}

// TODO 遍历投稿：根据返回的数据，多次取得视频数据，并更新到视频列表中。注意尽量避免被阿B风控。

// 格式化数字（单位：万）
export const formatNumber10K = (number) => {
    if (number > 10000) {
        return (number / 10000).toFixed(1).replace('.0', '') + '万';
    }
    return number;
}