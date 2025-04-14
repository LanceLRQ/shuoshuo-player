import {createSlice} from '@reduxjs/toolkit';
import {CloudServiceUserRoleNameMap} from "@/constants";

export const CloudServiceSlice = createSlice({
    name: 'cloud_service',
    initialState: {
        session: {
            token: '',
            id: '',
            expire_at: '',
            account: null
        }
    },
    reducers: {
        updateSession: (state,  { payload }) => {
            state.session.token = payload?.token;
            state.session.id = payload?.id;
            state.session.expire_at = payload?.expire_at;
            state.session.account = payload?.account;
        },
        clearSession: (state) => {
            state.session.token = '';
            state.session.id = '';
            state.session.expire_at = '';
            state.session.account = null;
        }
    },
    selectors: {
        sessionInfo: (state) => state.session,
        account: (state) => state.session?.account,
        expireAt: (state) => new Date(state.session?.expire_at * 1000),
        email: (state) => state.session?.account?.email,
        role: (state) => state.session?.account?.role,
        roleName: (state) => CloudServiceUserRoleNameMap[state.session?.account?.role] || '未知',
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
