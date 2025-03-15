import React, {useEffect, useState, useCallback, useMemo, useRef} from 'react';
import {Howl} from 'howler';
import "@styles/splayer.scss";
import { useTheme } from '@mui/material/styles';
import {Grid, IconButton, Stack, Slider, Popover} from '@mui/material';
import {useDispatch, useSelector} from "react-redux";
import {PlayingVideoListSelector} from "@/store/selectors/play_list";
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import {PlayingListSlice} from "@/store/play_list";
import {PlayerProfileSlice} from "@/store/ui";
import {fetchMusicUrl} from "@player/utils";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RepeatIcon from '@mui/icons-material/Repeat';
import RepeatOneIcon from '@mui/icons-material/RepeatOne';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';

function SPlayer() {
    const theme = useTheme();
    const dispatch = useDispatch();
    // Howl相关
    const howlInstance = useRef(null);
    const howlLoopInstance = useRef('loop');
    const [howlPlaying, setHowlPlaying] = useState(false);
    const [howlPausing, setHowlPausing] = useState(false);
    const [howlProcess, setHowlProcess] = useState(0);
    const [howlDuration, setHowlDuration] = useState(0);
    // 播放列表相关
    const playingList = useSelector(PlayingVideoListSelector);
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser)
    const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const playNext = useSelector(PlayingListSlice.selectors.playNext);
    const playerSetting = useSelector(PlayerProfileSlice.selectors.playerSetting);
    const playerLoopMode = useMemo(() => {
        return playerSetting.loopMode;
    }, [playerSetting])
    // == 弹层相关
    const [volumeEl, setVolumeEl] = useState(null);
    const handleVolumePopoverOpen = (event) => {
        setVolumeEl(event.currentTarget);
    };
    const handleVolumePopoverClose = () => {
        setVolumeEl(null);
    };
    const openVolumeBar = Boolean(volumeEl);
    // ==

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

    const updateProcess = useRef(() => {
        if (howlInstance.current) {
            setHowlProcess(howlInstance.current.seek())
        }
        requestAnimationFrame(updateProcess.current)
    })

    const howlPercentage = useMemo(() => {
        if (!howlDuration) return 0;
        return parseFloat(((howlProcess / howlDuration) * 100).toFixed(2));
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
            default:
                nextIndex = playIndex;
                break;
        }
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: nextIndex,
            playNext: true,
        }))
    }, [audioLists, playingInfo, dispatch])

    useEffect(() => {
        howlLoopInstance.current = playerLoopMode
    }, [playerLoopMode]);

    const handlePlayEnd = useCallback(() => {
        setHowlPausing(false);
        setHowlPlaying(false)
        if (!howlInstance.current) return;
        if (howlLoopInstance.current === 'single') {
            howlInstance.current.seek(0);
            howlInstance.current.play();
        } else if (howlLoopInstance.current === 'loop') {
            playNextItem('next')
        } else if (howlLoopInstance.current === 'random') {
            playNextItem('random')
        }
    }, [playNextItem, howlLoopInstance, howlInstance]);

    const initHowl = useCallback((curMusic) => {
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
                artwork: [{src: curMusic.cover}],
            })
        }
        curMusic.musicSrc().then((url) => {
            howlInstance.current = new Howl({
                src: [url],
                html5: true,
                volume: 1,
                mute: false,
                onplay: () => {
                    setHowlPausing(false);
                    setHowlPlaying(true)
                    setHowlDuration(howlInstance.current.duration())
                    requestAnimationFrame(updateProcess.current)
                },
                onpause: () => {
                    setHowlPausing(true);
                },
                onend: handlePlayEnd,
            });
            howlInstance.current.play();
            howlInstance.current.volume((playerSetting.volume !== undefined) ? playerSetting.volume : 1)
        })
    }, [howlInstance, playerSetting, handlePlayEnd, updateProcess]);

    // 播放控制相关
    const handleAudioVolumeChange = (event, volume) => {
        dispatch(PlayerProfileSlice.actions.setPlayerSetting({
            volume: volume
        }));
    }

    useEffect(() => {
        if (howlInstance.current) {
            howlInstance.current.volume((playerSetting.volume!== undefined) ? playerSetting.volume : 1)
        }
    }, [playerSetting, howlInstance])

    useEffect(() => {
        if (playNext) {
            console.log(currentMusic, 'currentMusic')
            initHowl(currentMusic)
            dispatch(PlayingListSlice.actions.removePlayNext({}));
        }
    }, [dispatch, initHowl, howlPlaying, playNext, currentMusic])

    const handlePlayClick = useCallback(() => {
        if (howlPausing) {
            howlInstance.current.play()
            setHowlPausing(false);
        } else {
            if (howlPlaying) {
                howlInstance.current.pause()
                setHowlPausing(true);
            } else {
                initHowl(currentMusic);
            }
        }
    }, [howlPausing, howlPlaying, initHowl, currentMusic, setHowlPausing])

    const handleSeekChange = useCallback((event, value) => {
        if (howlInstance.current) {
            howlInstance.current.seek(howlDuration * (value / 100));
        }
    }, [howlDuration])

    const handlePlayLoopModeClick = useCallback(() => {
        let loopMode = playerLoopMode;
        if (playerLoopMode ==='single') {
            loopMode = 'loop';
        } else if (playerLoopMode === 'loop') {
            loopMode = 'random';
        } else if (playerLoopMode === 'random') {
            loopMode = 'single';
        }
        dispatch(PlayerProfileSlice.actions.setPlayerSetting({
            loopMode: loopMode
        }))
    }, [dispatch, playerLoopMode])

    const durationToTime = (duration) => {
        if (isNaN(duration)|| !duration) return '0:00';
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // return <div style={{ zIndex: 100, position: "absolute", inset: "100px 300px", width: 400, height:200, background: 'white', color: 'black'}}>
    //     <div>Player Test Bar</div>
    //     <a onClick={() => {
    //         if (howlPausing) {
    //             howlInstance.current.play()
    //         } else {
    //             initHowl(currentMusic);
    //         }
    //     }}>Play</a> |
    //     <a onClick={() => howlInstance.current.pause()}>Pause</a> |
    //     <a onClick={() => howlInstance.current.stop()}>Stop</a> |
    //     <a onClick={() => { howlInstance.current.seek(howlDuration - 1) }}>Seek End</a>
    //     <br />
    //     current: {howlPercentage}% ({howlProcess}/{howlDuration})
    // </div>
    return <div className="splayer-main">
        <div className="splayer-slider-box">
            <Slider
                className="splayer-slider"
                size="small"
                step={0.01}
                min={0}
                max={100}
                value={howlPercentage}
                onChange={handleSeekChange}
                aria-label="time-indicator"
                valueLabelDisplay="off"
                sx={{
                    color: theme.palette.mode === 'dark' ? '#fff' : 'rgba(0,0,0,0.87)',
                }}
            />
            <div className="splayer-slider-current">
                {durationToTime(howlProcess)}
            </div>
            <div className="splayer-slider-duration">
                {durationToTime(howlDuration)}
            </div>
        </div>
        <Grid container className="splayer-layout">
            <Grid item md={4}>
                <div className="splayer-left-side">

                </div>
            </Grid>
            <Grid item md={4}>
                <Grid
                    container
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    className="splayer-controller-bar"
                >
                    <Stack direction="row" spacing={2}>
                        <div className="controller-bar-button">
                            <IconButton size="small" onClick={handlePlayLoopModeClick}>
                                {playerLoopMode === 'single' && <RepeatOneIcon/>}
                                {playerLoopMode === 'loop' && <RepeatIcon/>}
                                {playerLoopMode === 'random' && <ShuffleIcon/>}
                            </IconButton>
                        </div>
                        <div className="controller-bar-button">
                            <IconButton size="small" onClick={() => playNextItem('prev')}>
                                <SkipPreviousIcon/>
                            </IconButton>
                        </div>
                        <div className="controller-bar-button">
                            <IconButton size="large" aria-label="play" onClick={handlePlayClick}>
                                {(howlPausing || !howlPlaying) ? <PlayArrowIcon fontSize="large"/> : <PauseIcon fontSize="large"/>}
                            </IconButton>
                        </div>
                        <div className="controller-bar-button">
                            <IconButton size="small" onClick={() => playNextItem(playerLoopMode === 'random' ? 'random' : 'next')}>
                                <SkipNextIcon/>
                            </IconButton>
                        </div>
                        <div className="controller-bar-button">
                            <Popover
                                id="volume-popover"
                                open={openVolumeBar}
                                anchorEl={volumeEl}
                                anchorOrigin={{
                                    vertical: 'top',
                                    horizontal: 'center',
                                }}
                                transformOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'center',
                                }}
                                onClose={handleVolumePopoverClose}
                            >
                                <div className="splayer-volume-box">
                                    <Slider
                                        aria-label="volume"
                                        orientation="vertical"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={playerSetting.volume}
                                        valueLabelDisplay="off"
                                        onChange={handleAudioVolumeChange}
                                    />
                                </div>
                            </Popover>
                            <IconButton onClick={handleVolumePopoverOpen}>
                                <VolumeUpIcon/>
                            </IconButton>
                        </div>
                    </Stack>
                </Grid>
            </Grid>
            <Grid item md={4}>
                <div className="splayer-right-side"></div>
            </Grid>
        </Grid>
    </div>
}

export default SPlayer;