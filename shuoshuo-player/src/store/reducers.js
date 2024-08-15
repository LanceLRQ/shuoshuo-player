import { combineSlices } from '@reduxjs/toolkit';
import PlaylistSlices from "@/store/play_list";
import BilibiliReducerSlices from "@/store/bilibili";
import UIReducerSlices from "@/store/ui";

export const createRootReducer = () => {
    return combineSlices(
        ...BilibiliReducerSlices,
        ...PlaylistSlices,
        ...UIReducerSlices,
    );
};