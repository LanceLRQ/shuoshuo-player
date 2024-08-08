import { pick } from 'lodash';
import { combineReducers, createSlice } from '@reduxjs/toolkit';

export const BilibiliUserInfoReducer = createSlice({
    name: 'bili_user',
    initialState: {
        isLogin: false,
        face: '',
        uname: '',
        mid: '',
    },
    reducers: {
        updateUserInfo: (state, action) => {
            return {
                ...state,
                ...pick(action.payload, ['isLogin', 'face', 'uname', 'mid'])
            }
        }
    },
});

const ProfileReducerRoot = combineReducers({
    bili_user: BilibiliUserInfoReducer.reducer,   // B站用户信息
});

export default ProfileReducerRoot;
