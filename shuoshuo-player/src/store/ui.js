import { combineReducers, createSlice } from '@reduxjs/toolkit';
import {NoticeTypes} from "@/constants";

export const PlayerNoticesReducer = createSlice({
    name: 'notices',
    initialState: {
        list: []
    },
    reducers: {
        sendNotice: (state, action) => {
            const { payload } = action;
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
});

const UIReducerRoot = combineReducers({
    notices: PlayerNoticesReducer.reducer,   // B站用户信息
});

export default UIReducerRoot;
