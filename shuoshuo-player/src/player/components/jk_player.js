import React, {useEffect, useCallback, useState, useMemo} from 'react';
import ReactJkMusicPlayer from "react-jinke-music-player";
import {PlayingVideoListSelector} from "@/store/selectors/play_list";
import { useDispatch, useSelector } from "react-redux";
import {PlayingListSlice} from "@/store/play_list";
import {fetchMusicUrl} from "@player/utils";
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import {PlayerProfileSlice} from "@/store/ui";
import 'react-jinke-music-player/lib/styles/index.less';

export const CustomJkPlayer = () => {
    const [audioInstance, setAudioInstance] = useState(null);
    const dispatch = useDispatch();
    const playingList = useSelector(PlayingVideoListSelector);
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser)
    const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const playNext = useSelector(PlayingListSlice.selectors.playNext);
    const theme = useSelector(PlayerProfileSlice.selectors.theme);
    const playerSetting = useSelector(PlayerProfileSlice.selectors.playerSetting);
    const [playIndex, setPlayIndex] = useState(playingInfo?.index);

    const playingOptions = useMemo(() => {
        return {
            theme,
            clearPriorAudioLists: false,
            quietUpdate: true,
            ...playerSetting,
            // autoPlay: true,
        }
    }, [theme, playerSetting]);


    const handlePlayIndexChange = useCallback((pi) => {
        console.debug('ListenPIC', pi)
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: pi,
        }))
        setPlayIndex(pi);
    }, [dispatch])

    const handleThemeChange = (theme) => {
        dispatch(PlayerProfileSlice.actions.setTheme({
            theme
        }));
    }

    const audioLists = useMemo(() => {
         return playingList.map((vItem) => ({
            key: `${vItem.bvid}:1`,  // 后面的1是p1的意思，为后面如果要播分p的内容预留的
            name: vItem.title,
            singer: vItem.author,
            cover: vItem.pic,
            musicSrc: fetchMusicUrl(vItem.bvid, biliUser?.mid)
        }))
    }, [biliUser, playingList]);

    // 监听列表变化并同步
    // const handleAudioListsChange = useCallback((currentPlayId,audioLists) => {
    //     // dispatch(PlayingListSlice.actions.syncPlaylist({
    //     //     audioList: audioLists.map(item => item.key)
    //     // }))
    //     const { index, current_key } = playingInfo;
    //     if (playingKey !== current_key && index > -1) {
    //         setPlayIndex(index);
    //         setPlayingKey(current_key);
    //     }
    //     console.debug('ALI', playingKey, current_key, index)
    // }, [dispatch, playingInfo, playingKey]);

    const handleAudioListsDelete = (mode, audioKey) => {
        dispatch(PlayingListSlice.actions.syncPlaylistDelete({
            mode, audioKey
        }))
    }

    useEffect(() => {
        if (!playNext) return;
        const { index } = playingInfo;
        console.debug('PIC-PNEXT', index);
        if (index > -1) {
            setPlayIndex(index)
        }
        dispatch(PlayingListSlice.actions.removePlayNext({}));
    }, [dispatch, playNext, playingInfo]);

    useEffect(() => {
        console.debug('PAI', playIndex, !!audioInstance ? 'ready' : 'pending');
        if (audioInstance && playIndex > -1) {
            audioInstance.playByIndex(playIndex)
        }
    }, [audioInstance, playIndex]);

    const handleAudioVolumeChange = (volume) => {
        dispatch(PlayerProfileSlice.actions.setPlayerSetting({
            volume: Math.sqrt(volume)       // 喵的我也不知道为什么要开平方根，但是那个播放器源代码里边就是返回开了方的数值，导致对不上
        }));
    }

    const handleAudioPlayModeChange = (playMode) => {
        dispatch(PlayerProfileSlice.actions.setPlayerSetting({
            playMode
        }));
    }
    return <ReactJkMusicPlayer
        getAudioInstance={(instance) => {
            setAudioInstance(instance);
        }}
        mode="full"
        toggleMode={false}
        responsive={false}
        showDownload={false}
        defaultPlayIndex={playIndex}
        showMediaSession
        onPlayIndexChange={handlePlayIndexChange}
        // onAudioListsChange={handleAudioListsChange}
        onAudioListsDelete={handleAudioListsDelete}
        onThemeChange={handleThemeChange}
        onAudioVolumeChange={handleAudioVolumeChange}
        onAudioPlayModeChange={handleAudioPlayModeChange}
        audioLists={audioLists}
        {...playingOptions}
    />
}
export default CustomJkPlayer;