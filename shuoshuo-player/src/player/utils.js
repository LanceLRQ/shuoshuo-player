import API from '../api';
import { delay } from 'lodash';

import { BilibiliUserVideoListSlice } from "@/store/bilibili";
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
            dispatch(BilibiliUserVideoListSlice.actions.updateVideoList({
                mid, data: videoData, updateType: 'fully',
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

// 格式化数字（单位：万）
export const formatNumber10K = (number) => {
    if (number > 10000) {
        return (number / 10000).toFixed(1).replace('.0', '') + '万';
    }
    return number;
}