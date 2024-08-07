import { combineReducers, createSlice } from '@reduxjs/toolkit';

export const PlayingListReducer = createSlice({
    name: 'playing',
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

const PlayListReducerRoot = combineReducers({
    playing: PlayingListReducer.reducer,   // 正在播放的列表
});

export default PlayListReducerRoot;
