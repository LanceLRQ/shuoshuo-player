import { createSlice } from '@reduxjs/toolkit';

export const PlayingListSlice = createSlice({
    name: 'playing_list',
    initialState: {
        // 这个reducer将用于生成播放器的播放列表
        // 如果点击播放歌单，则通过这个id判断，并替换掉所有bv_ids
        // 如果单个播放，默认是追加到bv_ids列表中
        fav_id: '',             // 当前播放的歌单ID
        bv_ids: [],             // 视频的id列表
        current: '',            // 当前播放的视频的bvid，方便获取数据
        currentIndex: ''        // 当前播放的视频的index，用于播放器记忆
    },
    reducers: {
        addPlayingMusic: (state, action) => {
            const { playing } = state;
            playing.push(action.payload);
        },
    },
});

export const FavListSlice = createSlice({
    name: 'fav_list',
    initialState: {
        list: [],
        // 歌单列表， {
        //  id: '',
        //  type: 0,    // 0 - 自定义列表, 1 - up主投稿列表
        //  mid: '',    // B站up主uid (type == 1时)
        //  bv_ids: [],  // 自定义BV列表 (type == 0时)
        //  create_time: 0,     // 列表创建时间
        // }
    },
    reducers: {
        addPlayingMusic: (state, action) => {
            const { playing } = state;
            playing.push(action.payload);
        },
    },
});
