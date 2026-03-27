import {createSelector} from "reselect";
import {PlayingListSlice} from "@/store/play_list";
import {BilibiliVideoEntitiesSlice} from "@/store/bilibili";

export const PlayingVideoListSelector = createSelector(
    [
        PlayingListSlice.selectors.videoList,
        BilibiliVideoEntitiesSlice.selectors.videos
    ],
    (pList, videoEntities) => pList.map((bv) => videoEntities[bv]).filter(item => !!item)
)