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

// 读取用户的视频投稿信息
export const readUserVideos = async (dispatch, mid, query) => {
    try {
        if (!mid) return;
        const videoData = await API.Bilibili.UserApi.getUserVideoList({
            params: {
                mid,
                ...query,
            },
            headers: {
                'Hack-Referer': `https://space.bilibili.com/${mid}/video`,
            }
        });
        dispatch(BilibiliUserVideoListReducer.actions.updateVideoList({
            mid, data: videoData
        }));
    } catch (e) {}
}