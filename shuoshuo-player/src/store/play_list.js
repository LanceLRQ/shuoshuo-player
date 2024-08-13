import { createSlice } from '@reduxjs/toolkit';

export const PlayingListSlice = createSlice({
    name: 'playing_list',
    initialState: {
        list: [],            // 播放列表
        current: ''
    },
    reducers: {
        addPlayingMusic: (state, action) => {
            const { playing } = state;
            playing.push(action.payload);
            return { ...state, playing };
        },
    },
});
