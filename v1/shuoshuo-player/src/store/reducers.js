import { combineSlices } from '@reduxjs/toolkit';
import PlaylistSlices from "@/store/play_list";
import BilibiliReducerSlices from "@/store/bilibili";
import UIReducerSlices from "@/store/ui";
import LyricReducerSlices from "@/store/lyric";
import CloudServiceReducerSlices from "@/store/cloud_service";

export const createRootReducer = () => {
    return combineSlices(
        ...BilibiliReducerSlices,
        ...PlaylistSlices,
        ...UIReducerSlices,
        ...LyricReducerSlices,
        ...CloudServiceReducerSlices,
    );
};