import {createSelector} from "reselect";
import {BilibiliUserVideoListSlice, BilibiliVideoEntitiesSlice} from "@/store/bilibili";

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
