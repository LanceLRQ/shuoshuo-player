// 格式化数字（单位：万）
import API from "@/api";

export const formatNumber10K = (number) => {
    if (number > 10000) {
        return (number / 10000).toFixed(1).replace('.0', '') + '万';
    }
    return number;
}

window.MUSIC_PLAY_URL_CACHED = {};
window.MUSIC_PLAY_CLICK_TIME = {};

// 参考：https://github.com/Cteros/eno-music/blob/52b324ffd3f426555e82dfe0ad837588d6cf0abf/src/options/components/Play/Play.vue#L41
const getBVideoMusicURL = (obj) => {
    const url1 = obj.baseUrl || ''
    const url2 = obj.backup_url?.[0] || ''
    const url3 = obj.backup_url?.[1] || ''
    // 找到第一个不是https://xy 开头的url
    const urlList = [url1, url2, url3].filter(url => !url.startsWith('https://xy'))
    return urlList[0] || url1
}

export const fetchMusicUrl = (bvId, curUserMid) => async () => {
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
        cached.playUrl = getBVideoMusicURL(audioInfo)
        cached.last_update = Date.now() / 1000;
        window.MUSIC_PLAY_URL_CACHED[bvId] = cached;

        setTimeout(() => {
            const nt = Math.round(Date.now() / 1000);
            if (window.MUSIC_PLAY_CLICK_TIME[bvId] + 600 > nt) return  // 5分钟生效一次
            // 模拟B站点击，必须调用
            API.Bilibili.VideoApi.doClickStat({
                params: {
                    'w_aid': bVideoView?.aid,
                    'w_part': 1,
                    'w_ftime': nt,
                    'w_stime': nt,
                    'w_type': bVideoView?.desc_v2 ? bVideoView?.desc_v2?.[0]?.type : '1',
                },
                data: {
                    'aid': bVideoView?.aid,
                    'cid': bVideoView?.cid,
                    'bvid': bvId,
                    'part': '1',
                    'ftime': nt,
                    'stime': nt,
                    'mid': curUserMid,
                    'type': bVideoView?.desc_v2 ? bVideoView?.desc_v2?.[0]?.type : '1',
                    'sub_type': '0'
                }
            }).then(() => {
                // 只有成功才会走到这里
                window.MUSIC_PLAY_CLICK_TIME[bvId] = Math.round(Date.now() / 1000);
            }).catch(e => {
                console.debug('B站模拟点击失败：' + e);
            })
        }, 500);

        return cached.playUrl;
    } catch (e) {
        cached.loading = false;
        window.MUSIC_PLAY_URL_CACHED[bvId] = cached;
        console.debug(e);
        return '';
    }
};

export const searchResultConverter = (result) => {
    return result.map(item => {
        return {
         ...item,
        }
    });
}

export const urlPrefixFixed = (url) => {
    return String(url || '').replace(/^\/\//, 'https://').replace('http://', 'https://');
}
