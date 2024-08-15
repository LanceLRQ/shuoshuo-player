import {createSelector} from "reselect";
import {BilibiliUserVideoListSlice, BilibiliVideoEntitiesSlice} from "@/store/bilibili";
import {PlayingListSlice} from "@/store/play_list";

export const MasterVideoListSelector = createSelector(
    [
        BilibiliUserVideoListSlice.selectors.videoListInfo,
        BilibiliVideoEntitiesSlice.selectors.videos
    ],
    (uvList, videoEntities) => {
        const ret = {};
        Object.keys(uvList).forEach((key) => {
            const uv = uvList[key];
            if (uv?.video_list) {
                ret[key] = uv?.video_list?.map((item) => videoEntities[item.bvid]).filter(item => !!item);
            }
        })
        return ret;
    }
)

export const PlayingVideoListSelector = createSelector(
    [
        PlayingListSlice.selectors.videoList,
        BilibiliVideoEntitiesSlice.selectors.videos
    ],
    (pList, videoEntities) => pList.map((bv) => videoEntities[bv]).filter(item => !!item)
)