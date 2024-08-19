import React, { useEffect, useCallback, useState } from 'react';
import ReactJkMusicPlayer from "react-jinke-music-player";
import {PlayingVideoListSelector} from "@/store/selectors/play_list";
import { useDispatch, useSelector } from "react-redux";
import {PlayingListSlice} from "@/store/play_list";
import {fetchMusicUrl} from "@player/utils";

export const CustomJkPlayer = () => {

    const [audioInstance, setAudioInstance] = useState(null);
    const [audioLists, setAudioLists] = useState([]);
    const dispatch = useDispatch();
    const playingList = useSelector(PlayingVideoListSelector);
    // const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const gotoIndex = useSelector(PlayingListSlice.selectors.gotoIndex);
    const [playIndex, setPlayIndex] = useState(0)

    const [playingOptions, setPlayingOptions] =  useState({
        clearPriorAudioLists: true,
        autoPlay: true,
        quietUpdate: true,
        defaultVolume: 0.5,
    });

    const handlePlayIndexChange = useCallback((playIndex) => {
        console.log("PIC", playIndex)
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: playIndex,
        }))
    }, [dispatch])

    useEffect(() => {
        const newList = playingList.map((vItem) => ({
            key: vItem.bvid,
            name: vItem.title,
            singer: vItem.author,
            cover: vItem.pic,
            musicSrc: fetchMusicUrl(vItem.bvid)
        }))
        setAudioLists(newList);
    }, [playingList, gotoIndex]);


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
        audioLists={audioLists}
        {...playingOptions}
    />
}
export default CustomJkPlayer;