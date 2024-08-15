// 格式化数字（单位：万）
import API from "@/api";

export const formatNumber10K = (number) => {
    if (number > 10000) {
        return (number / 10000).toFixed(1).replace('.0', '') + '万';
    }
    return number;
}

window.MUSIC_PLAY_URL_CACHED = {};
export const fetchMusicUrl = (bvId) => async () => {
    const cached = window.MUSIC_PLAY_URL_CACHED[bvId] || {
        loading: false,
        last_update: 0,
        viewInfo: null,
        playInfo: null,
        playUrl: '',
    }
    if (cached.loading) return;
    if (cached.last_update > 0 && (cached.last_update + 3600) > (Date.now() / 1000)) {
        return cached.playUrl;
    }
    cached.loading = true;
    window.MUSIC_PLAY_URL_CACHED[bvId] = cached
    try {
        const bVideoView = await API.Bilibili.VideoApi.getVideoViewInfo({
            params: {
                bvid: bvId
            }
        })
        const {
            cid = 0     // 视频1p的cid
        } = bVideoView;
        const bPlayUrl = await API.Bilibili.VideoApi.getVideoPlayurl({
            params: {
                cid,
                fnval: 16,  // 请求DASH格式
                bvid: bvId,
            }
        })

        const audioInfoList = bPlayUrl?.dash?.audio ?? [];
        const findAutoById = (id) => audioInfoList.find(item => item.id === id);
        const audioInfo = findAutoById(30280) || findAutoById(30232) || findAutoById(30216); // 优先选择192K，后132K，最后是64K
        cached.loading = false;
        cached.viewInfo = bVideoView;
        cached.playInfo = bPlayUrl;
        cached.playUrl = audioInfo?.base_url || audioInfo?.baseUrl;
        cached.last_update = Date.now() / 1000;
        window.MUSIC_PLAY_URL_CACHED[bvId] = cached
        return cached.playUrl;
    } catch (e) {
        cached.loading = false;
        window.MUSIC_PLAY_URL_CACHED[bvId] = cached;
        console.debug(e);
        return '';
    }
};