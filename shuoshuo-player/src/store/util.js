import { buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit'
import {delay, isArray, pick} from "lodash";
import {BilibiliUserVideoInfoPickup} from "@/fields";

export const createAppSlice = buildCreateSlice({
    creators: { asyncThunk: asyncThunkCreator },
})

export const delayPromise = (time = 1000) => new Promise((resolve, reject) => {
    delay(() => {
        resolve();
    }, time)
})


const pickVideosField = (item, mode) => {
    const data = pick(item, BilibiliUserVideoInfoPickup);
    if (mode === 'view') {
        data.created = item?.ctime;
        data.length = item.duration;
        data.play = item?.stat?.view;
        data.comment = item?.stat?.reply;
        data.author = item?.owner?.name;
        data.mid = item?.owner?.mid;
    }
    return data;
}

export const pickVideosFields = (list, mode) => {
    if (isArray(list)) {
        return list.map(item => pickVideosField(item, mode));
    }
    return [pickVideosField(list, mode)]
}