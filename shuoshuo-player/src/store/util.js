import { buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit'
import {delay} from "lodash";

export const createAppSlice = buildCreateSlice({
    creators: { asyncThunk: asyncThunkCreator },
})

export const delayPromise = (time = 1000) => new Promise((resolve, reject) => {
    delay(() => {
        resolve();
    }, time)
})