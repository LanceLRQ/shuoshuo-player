import { combineSlices } from '@reduxjs/toolkit';
import { PlayingListSlice } from "@/store/play_list";
import BilibiliReducerSlices from "@/store/bilibili";
import UIReducerSlices from "@/store/ui";

export const createRootReducer = () => {
    return combineSlices(
        ...BilibiliReducerSlices,
        ...UIReducerSlices,
        PlayingListSlice,
    );
};