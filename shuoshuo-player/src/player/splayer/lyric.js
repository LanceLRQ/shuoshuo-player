import React, {useMemo} from 'react';
import { Typography, Box, Toolbar, IconButton } from '@mui/material';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import SearchIcon from '@mui/icons-material/Search';
import {useSelector} from "react-redux";
import {PlayingListSlice} from "@/store/play_list";
import {PlayingVideoListSelector} from "@/store/selectors/play_list";

function LyricViewer(props) {
    const { height } = props;
    const playingList = useSelector(PlayingVideoListSelector);
    const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const audioLists = useMemo(() => {
        return playingList.map((vItem) => ({
            key: `${vItem.bvid}:1`,  // 后面的1是p1的意思，为后面如果要播分p的内容预留的
            bvid: vItem.bvid,
            name: vItem.title,
            desc: String(vItem.description || '').replace(/<[^>]+>/g, ''),
            singer: vItem.author,
            cover: vItem.pic,
            payload: vItem,
        }))
    }, [playingList]);
    const currentMusic = useMemo(() => {
        return audioLists[playingInfo.index]
    }, [audioLists, playingInfo.index]);

    const coverImg = useMemo(() => {
        if (!currentMusic) return '';
        return currentMusic.cover;
    }, [currentMusic]);

    return <div className="player-lyric-main" style={{height: height}}>
        <div className="player-lyric-background-mask">
            <img src={coverImg} alt="cover" />
        </div>
        <Box sx={{flexGrow: 1}}>
            <Toolbar>
                <IconButton size="large" aria-label="close lyric" sx={{mr: 2}}>
                    <CloseFullscreenIcon/>
                </IconButton>
                <Typography variant="h6" component="div" sx={{flexGrow: 1}}>

                </Typography>
                <Box sx={{display: {xs: 'none', md: 'flex'}}}>
                    <IconButton>
                        <SearchIcon/>
                    </IconButton>
                </Box>
            </Toolbar>
        </Box>
    </div>
}

export default LyricViewer