import API from '../api';
import { delay } from 'lodash';
import { BilibiliUserInfoReducer } from "@/store/profile";
import { BilibiliUserVideoListReducer } from "@/store/caches";
import {PlayerNoticesReducer} from "@/store/ui";
import { NoticeTypes} from "@/constants";

let isLoading = {
    loadingUserVideos: false,
}

const delayPromise = (time = 1000) => new Promise((resolve, reject) => {
    delay(() => {
        resolve();
    }, time)
})

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
        if (!mid || isLoading.loadingUserVideos) return;
        isLoading.loadingUserVideos = true;
        dispatch(PlayerNoticesReducer.actions.sendNotice({
            id: 'load_user_videos_tip',
            type: NoticeTypes.INFO,
            message: '正在加载投稿列表',
            close: false,
        }));
        const videoData = await API.Bilibili.UserApi.getUserVideoList({
            params: {
                mid,
                ...query,
            }
        });
        isLoading.loadingUserVideos = false;
        dispatch(BilibiliUserVideoListReducer.actions.updateVideoList({
            mid, data: videoData
        }));
        dispatch(PlayerNoticesReducer.actions.removeNotice({id: 'load_user_videos_tip'}));
        dispatch(PlayerNoticesReducer.actions.sendNotice({
            type: NoticeTypes.SUCCESS,
            message: '更新完成',
            duration: 5000,
        }));
    } catch (e) {
        isLoading.loadingUserVideos = false;
    }
}

// 读取用户的视频投稿信息（全部）
export const readUserVideosAll = async (dispatch, mid, query) => {
    try {
        if (!mid || isLoading.loadingUserVideos) return;
        isLoading.loadingUserVideos = true;
        let pn = 1, ps = 30, total = -1, pp = -1;
        while(total === -1 || pn <= pp) {
            dispatch(PlayerNoticesReducer.actions.sendNotice({
                id: 'load_full_user_videos_tip',
                type: NoticeTypes.INFO,
                message: `正在加载完整投稿列表(${pn}/${pp === -1 ? '-' : pp})`,
                close: false,
            }));
            const videoData = await API.Bilibili.UserApi.getUserVideoList({
                params: {
                    mid,
                    ...query,
                    ps,
                    pn,
                }
            });
            total = videoData?.page?.count ?? 0;
            pp = Math.ceil(total / ps)
            dispatch(BilibiliUserVideoListReducer.actions.updateVideoList({
                mid, data: videoData
            }));
            await delayPromise();
            if (pn === pp || total <= 0 || pp === -1) {
                dispatch(PlayerNoticesReducer.actions.removeNotice({id: 'load_full_user_videos_tip'}));
                dispatch(PlayerNoticesReducer.actions.sendNotice({
                    type: NoticeTypes.SUCCESS,
                    message: '更新完成',
                    duration: 5000,
                }));
            }
            pn++;
        }
        isLoading.loadingUserVideos = false;
    } catch (e) {
        isLoading.loadingUserVideos = false;
    }
}

// TODO 遍历投稿：根据返回的数据，多次取得视频数据，并更新到视频列表中。注意尽量避免被阿B风控。

// 格式化数字（单位：万）
export const formatNumber10K = (number) => {
    if (number > 10000) {
        return (number / 10000).toFixed(1).replace('.0', '') + '万';
    }
    return number;
}