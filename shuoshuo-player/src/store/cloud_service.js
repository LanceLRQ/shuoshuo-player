import {createSlice} from '@reduxjs/toolkit';

export const CloudServiceSlice = createSlice({
    name: 'cloud_service',
    initialState: {
        session: {
            token: '',
            id: '',
            expire_at: '',
        }
    },
    reducers: {
        updateSession: (state,  { payload }) => {
            state.session.token = payload?.token;
            state.session.id = payload?.id;
            state.session.expire_at = payload?.expire_at;
        },
    },
    selectors: {
        sessionInfo: (state) => state.session,
        isLogin: (state) => {
            if (+new Date() > state.session?.expire_at * 1000) {
                return false;
            }
            return !!state.session?.token;
        }
    }
});


const CloudServiceReducerSlices = [
    CloudServiceSlice,        // 歌词存储器
];

export default CloudServiceReducerSlices;
