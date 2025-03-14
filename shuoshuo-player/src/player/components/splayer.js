import React, {useEffect, useState, useCallback, useMemo, useRef} from 'react';
import {Howl} from 'howler';
import {useDispatch, useSelector} from "react-redux";
import {PlayingVideoListSelector} from "@/store/selectors/play_list";
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import {PlayingListSlice} from "@/store/play_list";
import {PlayerProfileSlice} from "@/store/ui";
import {fetchMusicUrl} from "@player/utils";
import {swap} from "formik";

function SPlayer() {
    const dispatch = useDispatch();
    // Howl相关
    const howlInstance = useRef(null);
    const [howlPlaying, setHowlPlaying] = useState(false);
    const [howlProcess, setHowlProcess] = useState(0);
    const [howlDuration, setHowlDuration] = useState(0);
    const [playerLoopMode, setPlayerLoopMode] = useState('random');
    // 播放列表相关
    const playingList = useSelector(PlayingVideoListSelector);
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser)
    const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const playNext = useSelector(PlayingListSlice.selectors.playNext);
    const playerSetting = useSelector(PlayerProfileSlice.selectors.playerSetting);

    const audioLists = useMemo(() => {
        return playingList.map((vItem) => ({
            key: `${vItem.bvid}:1`,  // 后面的1是p1的意思，为后面如果要播分p的内容预留的
            name: vItem.title,
            singer: vItem.author,
            cover: vItem.pic,
            musicSrc: fetchMusicUrl(vItem.bvid, biliUser?.mid)
        }))
    }, [biliUser, playingList]);
    const currentMusic = useMemo(() => {
        return audioLists[playingInfo.index]
    }, [audioLists, playingInfo.index]);

    const updateProcess = () => {
        if (howlInstance.current) {
            setHowlProcess(howlInstance.current.seek())
        }
        requestAnimationFrame(updateProcess)
    }

    const howlPercentage = useMemo(() => {
        return (howlProcess / howlDuration) * 100
    }, [howlProcess, howlDuration]);

    const playNextItem = useCallback((type) => {
        const playIndex = playingInfo.index;
        let nextIndex = 0;
        switch (type) {
            case 'next':
                nextIndex = (playIndex + 1) % audioLists.length
                break;
            case 'prev':
                nextIndex = (playIndex - 1 + audioLists.length) % audioLists.length
                break;
            case 'random':
                nextIndex = Math.floor(Math.random() * audioLists.length)
                break;
        }
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: nextIndex,
            playNext: true,
        }))
    }, [audioLists, playingInfo])

    const initHowl = (curMusic) => {
        // 释放原有播放资源
        if (howlInstance.current) {
            howlInstance.current.stop()
            howlInstance.current.unload()
            howlInstance.current = null;
        }
        // 向浏览器注册媒体播放信息
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: curMusic.name,
                artist: curMusic.singer,
                album: curMusic.cover,
                artwork: [{ src:  curMusic.cover }],
            })
        }
        curMusic.musicSrc().then((url) => {
            howlInstance.current = new Howl({
                src: [url],
                html5: true,
                volume: 1,
                mute: false,
                onplay: () => {
                    setHowlPlaying(true)
                    setHowlDuration(howlInstance.current.duration())
                    requestAnimationFrame(updateProcess)
                },
                onpause: () => {
                    setHowlPlaying(false)
                },
                onend: () => {
                    if (playerLoopMode === 'single') {
                        initHowl(currentMusic)
                    } else if (playerLoopMode === 'loop') {
                        playNextItem('next')
                    } else if (playerLoopMode === 'random') {
                        playNextItem('random')
                    }
                },
            });
            howlInstance.current.play();
            howlInstance.current.volume((playerSetting.volume !== undefined) ? playerSetting.volume : 1)
        })
    };

    // 播放控制相关
    const handleAudioVolumeChange = (volume) => {
        dispatch(PlayerProfileSlice.actions.setPlayerSetting({
            volume: Math.sqrt(volume)       // 喵的我也不知道为什么要开平方根，但是那个播放器源代码里边就是返回开了方的数值，导致对不上
        }));
    }

    useEffect(() => {
        if (playNext) {
            console.log(currentMusic, 'currentMusic')
            initHowl(currentMusic)
            dispatch(PlayingListSlice.actions.removePlayNext({}));
        }
        return () => {
            if (howlPlaying && howlInstance.current) {
                howlInstance.current.stop()
            }
        }
    }, [howlPlaying, playNext, currentMusic])

    return <div style={{ zIndex: 100, position: "absolute", inset: "100px 300px", width: 400, height:200, background: 'white', color: 'black'}}>
        <div>Player Test Bar</div>
        <a onClick={() => initHowl(currentMusic)}>Play</a> |
        <a onClick={() => howlInstance.current.stop()}>Stop</a> |
        <a onClick={() => { howlInstance.current.seek(howlDuration - 1) }}>Seek End</a>
        <br />
        current: {howlPercentage}% ({howlProcess}/{howlDuration})
    </div>
}

export default SPlayer;