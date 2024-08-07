import { combineReducers, createSlice } from '@reduxjs/toolkit';

export const BilibiliCachesReducer = createSlice({
    name: 'bili_caches',
    initialState: {
        video: {}
    },
    reducers: {
        updateBilibiliVideoInfo: (state, action) => {
            const { video } = state;
            video[action.payload['bv']] = action.payload;
            return {...state, video};
        },
    },
});

const CachesReducerRoot = combineReducers({
    bili_caches: BilibiliCachesReducer.reducer
});

export default CachesReducerRoot;
