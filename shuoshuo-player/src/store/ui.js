import { createSlice } from '@reduxjs/toolkit';
import {NoticeTypes} from "@/constants";
import { nanoid } from "nanoid";

export const PlayerNoticesSlice = createSlice({
    name: 'ui_notices',
    initialState: {
        list: []
    },
    reducers: {
        sendNotice: (state, action) => {
            const { payload } = action;
            if (!state.list) state.list = [];
            const { id = nanoid() } = payload;
            const idx = state.list.findIndex(item => item.id === id);
            const obj = {
                id,
                type: payload.type ?? NoticeTypes.INFO,
                message: payload.message ?? '',
                vertical: payload.vertical ?? 'top',
                horizontal: payload.horizontal ?? 'center',
                action: payload.action ?? null,
                duration: payload.duration ?? null,
                close: payload.close ?? true,
            };
            if (idx > -1) {
                state.list[idx] = obj
            } else {
                state.list.push(obj);
            }
        },
        removeNotice: (state, action) => {
            const { id } = action.payload;
            const idx = state.list.findIndex(item => item.id === id);
            if (idx > -1) {
                state.list.splice(idx, 1)
            }
        }
    },
    selectors: {
        noticeList: (state) => state.list,
    }
});


export const PlayerProfileSlice = createSlice({
    name: 'ui_profile',
    initialState: {
        theme: 'dark'
    },
    reducers: {
        setTheme: (state, action) => {
            const { theme } = action.payload;
            if (theme !== 'light' && theme !== 'dark' && theme !== 'auto') {
                state.theme = 'dark';
                return;
            }
            state.theme = theme;
        },
    },
    selectors: {
        theme: (state) => {
            if (state.theme === 'auto') {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    return 'dark';
                } else {
                    return 'light';
                }
            }
            return state.theme;
        },
    }
});



const UIReducerSlices = [
    PlayerNoticesSlice,        // 播放器通知UI
    PlayerProfileSlice
];

export default UIReducerSlices;
