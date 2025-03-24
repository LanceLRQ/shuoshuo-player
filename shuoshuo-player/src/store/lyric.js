import {createSlice} from '@reduxjs/toolkit';

export const LyricSlice = createSlice({
    name: 'lyrics',
    initialState: {
        lyricMaps: {},
    },
    reducers: {
        updateLyric: (state, action) => {
            const { payload } = action;
            const { lyricMap } = state;
            const { bvid = '' } = payload;
            if (!bvid) return;
            lyricMap[bvid] = {
                ...lyricMap[bvid],
                ...payload,
            };
        },
        removeLyric: (state, action) => {
            const { bvid = '' } = action.payload;
            if (!bvid) return;
            delete state.lyricMaps[bvid];
        }
    },
    selectors: {
        lyricMaps: (state) => state.lyricMaps,
    }
});


const LyricReducerSlices = [
    LyricSlice,        // 歌词存储器
];

export default LyricReducerSlices;
