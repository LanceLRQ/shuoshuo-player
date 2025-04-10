import {buildApiCall} from "@/api/axios";

const Lyric = {
    getLyricByBvid: (bvid) => buildApiCall({
        url: `/lyric/${bvid}`,
    }),
}

export const api = {
    Lyric
}

export default api;