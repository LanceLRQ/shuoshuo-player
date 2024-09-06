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
    const [playingKey, setPlayingKey] = useState('');
    const [playIndex, setPlayIndex] = useState(playingInfo?.index);

    const playingOptions = useMemo(() => {
        return {
            theme,
            clearPriorAudioLists: true,
            quietUpdate: true,
            ...playerSetting,
            autoPlay: true,
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
        console.log('AListUPD')
         return playingList.map((vItem) => ({
            key: vItem.bvid,
            name: vItem.title,
            singer: vItem.author,
            cover: vItem.pic,
            musicSrc: fetchMusicUrl(vItem.bvid, biliUser?.mid)
        }))
    }, [biliUser, playingList]);

    // 监听列表变化并同步
    const handleAudioListsChange = useCallback((currentPlayId,audioLists) => {
        dispatch(PlayingListSlice.actions.syncPlaylist({
            audioList: audioLists.map(item => item.key)
        }))
        const { index, current } = playingInfo;
        if (playingKey !== current && index > -1) {
            setPlayIndex(index)
        }
        console.debug('ALI', playingKey, current, index)
    }, [dispatch, playingInfo, playingKey]);

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
            volume
        }));
    }

    const handleAudioPlayModeChange = (playMode) => {
        dispatch(PlayerProfileSlice.actions.setPlayerSetting({
            playMode
        }));
    }
    console.log(playIndex, 'pl:render');
    return <ReactJkMusicPlayer
        getAudioInstance={(instance) => {
            setAudioInstance(instance);
        }}
        mode="full"
        toggleMode={false}
        responsive={false}
        showDownload={false}
        playIndex={playIndex}
        showMediaSession
        onPlayIndexChange={handlePlayIndexChange}
        onAudioListsChange={handleAudioListsChange}
        onThemeChange={handleThemeChange}
        onAudioVolumeChange={handleAudioVolumeChange}
        onAudioPlayModeChange={handleAudioPlayModeChange}
        onAudioPlay={(audioInfo) => {setPlayingKey(audioInfo?.key)}}
        onAudioEnded={() => {setPlayingKey('')}}
        audioLists={audioLists}
        {...playingOptions}
    />
}
export default CustomJkPlayer;