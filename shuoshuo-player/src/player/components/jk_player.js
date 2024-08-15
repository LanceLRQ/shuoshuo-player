import React, { useMemo, useCallback, useState } from 'react';
import ReactJkMusicPlayer from "react-jinke-music-player";
import {PlayingVideoListSelector} from "@/store/selectors/bilibili";
import { useDispatch, useSelector } from "react-redux";
import {PlayingListSlice} from "@/store/play_list";
import API from "@/api";

export const CustomJkPlayer = () => {

    const [audioInstance, setAudioInstance] = useState(null);
    const dispatch = useDispatch();
    const playingList = useSelector(PlayingVideoListSelector);
    const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const playIndex = playingInfo.index ?? 0;
    const playingOptions = {
        autoPlay: false,
    }

    const handlePlayIndexChange = useCallback((playIndex) => {
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: playIndex,
        }))
    }, [dispatch])

    const handleAudioListsChange = () => () => {
        if (!audioInstance) return;
        audioInstance.playByIndex(playIndex)
    }

    const audioLists =  useMemo(() => {
        return playingList.map((vItem) => ({
            key: vItem.bvid,
            name: vItem.title,
            singer: vItem.author,
            cover: vItem.pic,
            musicSrc: async () => {
                const bVideoView = await API.Bilibili.VideoApi.getVideoViewInfo({
                    params: {
                        bvid: vItem.bvid
                    }
                })
                const {
                    cid = 0     // 视频1p的cid
                } = bVideoView;
                const bPlayUrl = await API.Bilibili.VideoApi.getVideoPlayurl({
                    params: {
                        cid,
                        fnval: 16,  // 请求DASH格式
                        bvid: vItem.bvid,
                    }
                })

                const audioInfoList = bPlayUrl?.dash?.audio ?? [];
                const findAutoById = (id) => audioInfoList.find(item => item.id === id);
                const audioInfo = findAutoById(30280) || findAutoById(30232) || findAutoById(30216); // 优先选择192K，后132K，最后是64K
                return audioInfo?.base_url || audioInfo?.baseUrl;
            },
        }))
    }, [playingList]);

    return <ReactJkMusicPlayer
        getAudioInstance={(instance) => {
            setAudioInstance(instance);
        }}
        mode="full"
        toggleMode={false}
        responsive={false}
        clearPriorAudioLists={true}
        showMediaSession
        playIndex={playIndex}
        onPlayIndexChange={handlePlayIndexChange}
        onAudioListsChange={handleAudioListsChange()}
        audioLists={audioLists}
        {...playingOptions}
    />
}
export default CustomJkPlayer;