import React, {useEffect, useState, useCallback, useMemo, useRef} from 'react';
import {Howl} from 'howler';
import "@styles/splayer.scss";
import { useTheme } from '@mui/material/styles';
import {Grid, IconButton, Stack, Slider, Popover, CircularProgress, Drawer} from '@mui/material';
import {useDispatch, useSelector} from "react-redux";
import Marquee from '../components/marquee';
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
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
// import ShareIcon from '@mui/icons-material/Share';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import AddFavDialog from "@player/dialogs/add_fav_dialog";
import PlayingList from "@player/splayer/playing_list";
import LyricsIcon from '@mui/icons-material/Lyrics';
import { blue } from '@mui/material/colors';
import LyricViewer from "@player/splayer/lyric";
import API from "@/api";
import {LyricSlice} from "@/store/lyric";
import { Lrc as LrcKit } from 'lrc-kit';
import {createLyricsFinder} from "@/utils";

function SPlayer() {
    const theme = useTheme();
    const dispatch = useDispatch();
    // == Howl相关
    const howlInstance = useRef(null);
    const howlLoopInstance = useRef('loop');
    const [howlPlaying, setHowlPlaying] = useState(false);
    const [howlPausing, setHowlPausing] = useState(false);
    const [howlProcess, setHowlProcess] = useState(0);
    const [howlDuration, setHowlDuration] = useState(0);
    // == 播放列表相关
    const [isMusicLoading, setIsMusicLoading] = useState(false);
    const [favListDialogOpen, setFavListDialogOpen] = useState(false);
    const themeMode = useSelector(PlayerProfileSlice.selectors.theme);
    const playingList = useSelector(PlayingVideoListSelector);
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser)
    const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const playNext = useSelector(PlayingListSlice.selectors.playNext);
    const playerSetting = useSelector(PlayerProfileSlice.selectors.playerSetting);
    const playerLoopMode = useMemo(() => {
        return playerSetting.loopMode;
    }, [playerSetting])
    const audioLists = useMemo(() => {
        return playingList.map((vItem) => ({
            key: `${vItem.bvid}:1`,  // 后面的1是p1的意思，为后面如果要播分p的内容预留的
            bvid: vItem.bvid,
            name: vItem.title,
            desc: String(vItem.description || '').replace(/<[^>]+>/g, ''),
            singer: vItem.author,
            cover: vItem.pic,
            musicSrc: fetchMusicUrl(vItem.bvid, biliUser?.mid),
            payload: vItem,
        }))
    }, [biliUser, playingList]);
    const currentMusic = useMemo(() => {
        return audioLists[playingInfo.index]
    }, [audioLists, playingInfo.index]);
    // == 弹层相关
    const [volumeEl, setVolumeEl] = useState(null);
    const handleVolumePopoverOpen = (event) => {
        setVolumeEl(event.currentTarget);
    };
    const handleVolumePopoverClose = () => {
        setVolumeEl(null);
    };
    const openVolumeBar = Boolean(volumeEl);
    // == 歌词窗口相关
    const [ lyricView, setLyricView] = useState(true);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);
    useEffect(() => {
        const handleResize = () => {
            setWindowHeight(window.innerHeight);
        };
        // 监听窗口大小变化
        window.addEventListener('resize', handleResize);
        // 清除事件监听
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });
    // == 歌词服务 ==
    const LrcInfos = useSelector(LyricSlice.selectors.lyricMaps)
    const LrcInfo = useMemo(() => {
        if (!currentMusic) return {};
        return LrcInfos[currentMusic.bvid]?? {};
    }, [currentMusic, LrcInfos]);

    // ==================


    // == 播放进度控制 ==
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
        setIsMusicLoading(true)
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
            setIsMusicLoading(false);
            howlInstance.current.play();
            howlInstance.current.volume((playerSetting.volume !== undefined) ? playerSetting.volume : 1);
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
            console.debug(currentMusic, 'currentMusic')
            if (!currentMusic && howlPlaying) {
                // 如果当前播放的音乐被移除，则停止播放
                howlInstance.current.stop();
                setHowlPausing(false);
                setHowlPlaying(false);
                return;
            } else if (currentMusic) {
                initHowl(currentMusic)
            }
            dispatch(PlayingListSlice.actions.removePlayNext({}));
        }
    }, [
        dispatch, initHowl, howlPlaying, playNext, howlInstance,
        currentMusic, setHowlPausing ,setHowlPlaying
    ])

    // 自动从云服务拉取歌词信息
    useEffect( () => {
        if (!currentMusic) return;
        if (LrcInfo && LrcInfo.lrc) return;
        API.CloudService.Lyric.getLyricByBvid(currentMusic.bvid)({}).then(resp => {
            const lrcContent = resp?.content;
            dispatch(LyricSlice.actions.updateLyric({
                bvid: currentMusic.bvid,
                lrc: lrcContent,
                offset: 0,
                source: '说说播放器云服务',
            }));
        }).catch((resp) => {
            console.warn(resp.message);
            // dispatch(PlayerNoticesSlice.actions.sendNotice({
            //     type: NoticeTypes.ERROR,
            //     message: `获取视频(${currentMusic.bvid})歌词信息失败`,
            //     duration: 3000,
            // }));
        });
    }, [LrcInfo, currentMusic, dispatch])

    const handlePlayClick = useCallback(() => {
        if (isMusicLoading || !currentMusic) return;
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
    }, [howlPausing, howlPlaying, initHowl, currentMusic, setHowlPausing, isMusicLoading])

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

    const handleGotoBilibili = useCallback(() => {
        if (currentMusic) {
            window.open('https://bilibili.com/video/' + currentMusic.bvid);
        }
    }, [currentMusic])

    const durationToTime = (duration) => {
        if (isNaN(duration)|| !duration) return '0:00';
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // === 歌词计算
    const lrcParsedFinder = useMemo(() => {
        if (!LrcInfo || !LrcInfo.lrc) return null;
        const lrcParsedInfo = LrcKit.parse(LrcInfo.lrc);
        const lrcList = lrcParsedInfo.lyrics;
        if (lrcList.length <= 0) return null;
        // 排序一次
        return createLyricsFinder(lrcList, LrcInfo.offset)
    }, [LrcInfo]);

    const playerCardDescWithLrc = useMemo(() => {
        if (howlPlaying && lrcParsedFinder) {
            const rel = lrcParsedFinder(howlProcess)?.value
            if (rel) return rel?.content;
        }
        return '';
    }, [lrcParsedFinder, howlPlaying, howlProcess])

    return <>
        {currentMusic && <Drawer className="player-lyric-drawer" open={lyricView} anchor="bottom">
            <LyricViewer
                currentMusic={currentMusic}
                height={windowHeight}
                onToggleLyricView={setLyricView}
                duration={howlProcess}
            />
        </Drawer>}
        <div className={`splayer-main splayer-theme-${themeMode}`}>
            {currentMusic && !lyricView && <div className="splayer-background" style={{backgroundImage: `url(${currentMusic.cover})`}}></div>}
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
                <Grid item md={4} lg={3} xs={12}>
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
                                    {isMusicLoading ?
                                        <CircularProgress /> :
                                        ((howlPausing || !howlPlaying) ? <PlayArrowIcon fontSize="large"/> : <PauseIcon fontSize="large"/>)
                                    }
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
                <Grid item md={6} lg={6} xs={12}>
                    {currentMusic && <div className="splayer-middle-side">
                        <div className="splayer-music-card">
                            <div className="splayer-music-card-cover">
                                <img src={currentMusic.cover} alt="cover"/>
                            </div>
                            <div className="splayer-music-card-info">
                                <div className="splayer-music-card-title">{currentMusic.name}</div>
                                <div className="splayer-music-card-desc">
                                    {howlPlaying && playerCardDescWithLrc ?
                                        <span>{playerCardDescWithLrc}</span> :
                                        <Marquee text={currentMusic?.desc} speed={0.2} />}
                                </div>
                            </div>
                            <div className="splayer-music-card-extra">
                                <div className="splayer-music-card-extra-item">
                                    <IconButton size="small" onClick={handleGotoBilibili}>
                                        <InfoIcon  fontSize="12px" />
                                    </IconButton>
                                </div>
                                {/*<div className="splayer-music-card-extra-item">*/}
                                {/*    <IconButton size="small">*/}
                                {/*        <ShareIcon fontSize="12px"/>*/}
                                {/*    </IconButton>*/}
                                {/*</div>*/}
                            </div>
                        </div>
                    </div>}
                </Grid>
                <Grid item md={2} lg={3} xs={12}>
                    <div className="splayer-right-side">
                        <div className="splayer-operator-bar">
                            <div className="splayer-operator-bar-item">
                                <IconButton  onClick={() => setLyricView(!lyricView)}>
                                    <LyricsIcon  sx={{ color: lyricView ? blue[500] : null }} />
                                </IconButton>
                            </div>
                            <div className="splayer-operator-bar-item">
                                <IconButton onClick={() => setFavListDialogOpen(true)}>
                                    <AddIcon />
                                </IconButton>
                            </div>
                            <div className="splayer-operator-bar-item">
                                <PlayingList>
                                    {({ open }) => {
                                        return <IconButton onClick={open}>
                                            <QueueMusicIcon />
                                        </IconButton>
                                    }}
                                </PlayingList>
                            </div>
                        </div>
                    </div>
                </Grid>
            </Grid>
            {currentMusic && <AddFavDialog
                open={favListDialogOpen}
                onClose={() => setFavListDialogOpen(false)}
                excludeFavId=""
                video={currentMusic.payload}
                formSearch={false}
            />}
        </div>
    </>
}

export default SPlayer;