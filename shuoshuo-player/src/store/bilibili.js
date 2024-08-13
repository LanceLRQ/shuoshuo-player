import { isArray, pick } from 'lodash';
import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import {BilibiliUserVideoListPickup} from "@/fields";
import {TimeStampNow} from "@/utils";
import {PlayerNoticesReducer} from "@/store/ui";
import {NoticeTypes} from "@/constants";
import API from "@/api";
import { createAppSlice } from "@/store/util";


export const BilibiliUserInfoSlice = createAppSlice({
    name: 'bili_current_user',
    initialState: {
        isInited: false,
        isLogin: false,
        current: {
            face: '',
            uname: '',
            mid: '',
        }
    },
    reducers: (create) => ({
        getLoginUserInfo: create.asyncThunk(
            async (params, { dispatch }) => {
                try {
                    return await API.Bilibili.UserApi.getUserInfo();
                } catch (e) {
                    return null;
                }
            },
            {
                fulfilled: (state, action) => {
                    if (!action.payload) return;
                    const userData = action.payload;
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
                    state.isInited = true;
                    state.isLogin = userData?.isLogin;
                    state.current = {
                        ...pick(userData, ['face', 'uname', 'mid'])
                    }
                },
            }
        ),
    }),
    selectors: {
        currentUser: (state) => state.current,
        isLogin: (state) => state.isLogin,
        isInited: (state) => state.isInited,
    }
});

const BVideoAdapter = createEntityAdapter({
    selectId: (video) => video.bvid,
    sortComparer: (a, b) => a?.created > b?.created ? -1 : 0,
})

export const BilibiliVideoEntitiesSlice = createSlice({
    name: 'bili_videos',
    initialState: BVideoAdapter.getInitialState({}),
    reducers: {
        upsertMany: BVideoAdapter.upsertMany,
    },
});

export const BilibiliUserVideoListSlice = createAppSlice({
    name: 'bili_user_videos',
    initialState: {
        isLoading: false,
        // <mid>: { <uEntity> }
    },
    selectors: {
        loadingStatus: (state) => state.isLoading,
        masterVideoListInfo:  (state, mid) => state[mid],
    },
    reducers: (create) => ({
        readUserVideos: create.asyncThunk(
            async (params, { dispatch }) => {
                const { mid, query } = params;
                dispatch(PlayerNoticesReducer.actions.sendNotice({
                    id: 'load_user_videos_tip',
                    type: NoticeTypes.INFO,
                    message: '正在加载投稿列表',
                    close: false,
                }));
                debugger;
                try {
                    const videoData = await API.Bilibili.UserApi.getUserVideoList({
                        params: {
                            mid,
                            ...query,
                        }
                    });
                    dispatch(BilibiliUserVideoListSlice.actions.updateVideoList({
                        mid, data: videoData, updateType: 'default',
                    }));
                    dispatch(BilibiliVideoEntitiesSlice.actions.upsertMany(videoData))
                } catch (e) {}
                dispatch(PlayerNoticesReducer.actions.removeNotice({id: 'load_user_videos_tip'}));
                dispatch(PlayerNoticesReducer.actions.sendNotice({
                    type: NoticeTypes.SUCCESS,
                    message: '更新完成',
                    duration: 5000,
                }));
            },
            {
                pending: (state) => {
                    state.isLoading = true
                },
                rejected: (state, action) => {
                    state.isLoading = false
                },
                fulfilled: (state, action) => {
                    state.isLoading = false;
                },
            }
        ),
        updateVideoList: create.reducer((state, action) => {
            const mid = action.payload?.mid;
            const vData = action.payload?.data;
            const updateType = action.payload?.updateType ?? 'default';
            const uEntity = state[mid] ?? {
                update_time: 0,      // 上次更新时间
                video_list: [],      // 视频数据列表 { bv, created }
                count: 0,            // 视频数量
                update_type: '',     // default - 更新前30；fully - 全量
            }
            const videoList = vData?.list?.vlist ?? [];
            const pageCount = vData?.page?.count ?? 0;
            if (isArray(videoList)){
                // 注意使用B站正常的倒序排列方式获取，更新的时候会依次检查是否已存在列表中，如果存在则更新数据，
                // 否则是插入数据，最后再按照创建时间重新排列。
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
            uEntity.update_type = updateType;
            state[mid] = uEntity;
        })
    }),
});

const BilibiliReducerSlices = [
    BilibiliUserInfoSlice,
    BilibiliVideoEntitiesSlice,         // 视频信息缓存
    BilibiliUserVideoListSlice,         // 用户投稿视频列表
];

export default BilibiliReducerSlices;
