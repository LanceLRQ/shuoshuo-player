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
    const [audioLists, setAudioLists] = useState([]);
    const dispatch = useDispatch();
    const playingList = useSelector(PlayingVideoListSelector);
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser)
    // const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const gotoIndex = useSelector(PlayingListSlice.selectors.gotoIndex);
    const [playIndex, setPlayIndex] = useState(0);
    const theme = useSelector(PlayerProfileSlice.selectors.theme);

    const playingOptions = useMemo(() => {
        return {
            theme,
            clearPriorAudioLists: true,
            autoPlay: false,
            quietUpdate: true,
            defaultVolume: 0.5,
        }
    }, [theme]);

    const handlePlayIndexChange = useCallback((playIndex) => {
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: playIndex,
        }))
    }, [dispatch])

    const handleThemeChange = (theme) => {
        dispatch(PlayerProfileSlice.actions.setTheme({
            theme
        }));
    }

    useEffect(() => {
        const newList = playingList.map((vItem) => ({
            key: vItem.bvid,
            name: vItem.title,
            singer: vItem.author,
            cover: vItem.pic,
            musicSrc: fetchMusicUrl(vItem.bvid, biliUser?.mid)
        }))
        setAudioLists(newList);
    }, [biliUser, playingList, gotoIndex]);


    // -- 我也不知道这玩意为什么可以但是就这么搞就行了.........
    const handleAudioListsChange = useCallback(() => {
        if (gotoIndex > -1) {
            setPlayIndex(gotoIndex)
        }
    }, [gotoIndex]);

    useEffect(() => {
        if (audioInstance && gotoIndex > -1) {
            audioInstance.playByIndex(gotoIndex)
        }
    }, [handleAudioListsChange, audioInstance, gotoIndex]);

    return <ReactJkMusicPlayer
        getAudioInstance={(instance) => {
            setAudioInstance(instance);
        }}
        mode="full"
        toggleMode={false}
        responsive={false}
        playIndex={playIndex}
        showMediaSession
        onPlayIndexChange={handlePlayIndexChange}
        onAudioListsChange={handleAudioListsChange}
        onThemeChange={handleThemeChange}
        audioLists={audioLists}
        {...playingOptions}
    />
}
export default CustomJkPlayer;