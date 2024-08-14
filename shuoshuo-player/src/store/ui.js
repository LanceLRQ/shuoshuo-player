import { createSlice } from '@reduxjs/toolkit';
import {NoticeTypes} from "@/constants";

export const PlayerNoticesSlice = createSlice({
    name: 'ui_notices',
    initialState: {
        list: []
    },
    reducers: {
        sendNotice: (state, action) => {
            const { payload } = action;
            if (!state.list) state.list = [];
            const { id = Date.now() + '_' + Math.round(Math.random() * 1000) } = payload;
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

const UIReducerSlices = [
    PlayerNoticesSlice        // 播放器通知UI
];

export default UIReducerSlices;
