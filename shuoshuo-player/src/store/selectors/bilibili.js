import {isObject} from "lodash";
import {createSelector} from "reselect";
import {BilibiliUserVideoListSlice, BilibiliVideoEntitiesSlice} from "@/store/bilibili";

export const MasterVideoListSelector = createSelector(
    [
        BilibiliUserVideoListSlice.selectors.sliceSelf,
        BilibiliVideoEntitiesSlice.selectors.videos
    ],
    (uvList, videos) => {
        const ret = {};
        Object.keys(uvList).forEach((key) => {
            const uv = uvList[key];
            if (isObject(uv) && uv?.video_list) {
                ret[key] = uv?.video_list?.map((item) => videos[item.bvid]).filter(item => !!item);
            }
        })
        return ret;
    }
)