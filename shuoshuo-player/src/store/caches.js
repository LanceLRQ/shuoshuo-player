import { isArray, pick } from 'lodash';
import { combineReducers, createSlice } from '@reduxjs/toolkit';
import {BilibiliUserVideoListPickup} from "@/fields";
import {TimeStampNow} from "@/utils";

export const BilibiliVideoInfoCachesReducer = createSlice({
    name: 'video_info',
    initialState: {
        video: {}
    },
    reducers: {
        updateBilibiliVideoInfo: (state, action) => {
            const { video } = state;
            video[action.payload['bvid']] = action.payload;
        },
    },
});

export const BilibiliUserVideoListReducer = createSlice({
    name: 'bili_user_videos',
    initialState: {
        // <mid>: { <uEntity> }
    },
    reducers: {
        updateVideoList: (state, action) => {
            const mid = action.payload?.mid;
            const vData = action.payload?.data;
            const uEntity = state[mid] ?? {
                update_time: 0,      // 上次更新时间
                video_list: [],      // 视频数据列表(预处理)
                count: 0,            // 视频数量
            }
            const videoList = vData?.list?.vlist ?? [];
            const pageCount = vData?.page?.count ?? 0;
            if (isArray(videoList)){
                // 注意使用B站正常的倒序排列方式获取，更新的时候会依次检查是否已存在列表中，如果存在则更新数据，
                // 否则是插入数据，最后再按照创建时间重新排列。这边直接o(N^2)，没必要考虑性能，能发几万个视频的up主不一般，叔叔服务器不爆炸，chrome的storage都爆炸了。
                videoList.forEach((video) => {
                    const vIndex = uEntity.video_list.findIndex(item => item.bvid === video.bvid);
                    if (vIndex > -1) {
                        uEntity.video_list[vIndex] = pick(video, BilibiliUserVideoListPickup);
                    } else {
                        uEntity.video_list.push(pick(video, BilibiliUserVideoListPickup))
                    }
                })
            }
            uEntity.video_list.sort((a, b) => a?.created > b?.created ? -1 : 0);
            uEntity.count = pageCount;
            uEntity.update_time = TimeStampNow();
            state[mid] = uEntity;
        },
    },
});

const CachesReducerRoot = combineReducers({
    video_info: BilibiliVideoInfoCachesReducer.reducer,
    user_video_list: BilibiliUserVideoListReducer.reducer,
});

export default CachesReducerRoot;
