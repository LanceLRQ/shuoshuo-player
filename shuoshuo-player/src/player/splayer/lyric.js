import React, {useMemo} from 'react';
import { Typography, Box, Toolbar, IconButton } from '@mui/material';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import SearchIcon from '@mui/icons-material/Search';
import { Lrc as ReactLRC } from "react-lrc";
import PropTypes from "prop-types";
import LRCSearchDialog from "@player/dialogs/lrc_search";
import isElectron from "is-electron";
import {useDispatch, useSelector} from "react-redux";
import {LyricSlice} from "@/store/lyric";
import DeleteIcon from "@mui/icons-material/Delete";

function LyricViewer(props) {
    const { height, onToggleLyricView, duration, currentMusic } = props;
    const inElectron = isElectron();
    const dispatch = useDispatch();
    const LrcInfos = useSelector(LyricSlice.selectors.lyricMaps)
    const LrcInfo = useMemo(() => {
        if (!currentMusic) return {};
        return LrcInfos[currentMusic.bvid]?? {};
    }, [currentMusic, LrcInfos]);
    const isDebugging = process.env.NODE_ENV === 'development';

    const coverImg = useMemo(() => {
        if (!currentMusic) return '';
        return currentMusic.cover;
    }, [currentMusic]);


    const handleDebugClearLRC = () => {
        if (!currentMusic.bvid) return;
        dispatch(LyricSlice.actions.updateLyric({
            bvid: currentMusic.bvid,
            lrc: '',
            offset: 0,
            source: 'QQ音乐',
        }));
    }

    return <div className="player-lyric-main" style={{height: height}}>
        <div className="player-lyric-background-mask">
            <img src={coverImg} alt="cover" />
        </div>
        <Box className="player-lyric-top-bar" sx={{flexGrow: 1}}>
            <Toolbar>
                <IconButton size="large" aria-label="close lyric" sx={{mr: 2}} onClick={() => onToggleLyricView(false)}>
                    <CloseFullscreenIcon/>
                </IconButton>
                <Typography variant="h6" component="div" sx={{flexGrow: 1}}>

                </Typography>
                <Box sx={{display: {xs: 'none', md: 'flex'}}}>
                    {inElectron && <LRCSearchDialog bvid={currentMusic.bvid}>
                        {(slot) => {
                            return <IconButton onClick={() => slot.handleOpen(currentMusic?.name ?? '')}>
                                <SearchIcon/>
                            </IconButton>
                        }}
                    </LRCSearchDialog>}
                    {isDebugging && <IconButton onClick={handleDebugClearLRC}>
                        <DeleteIcon></DeleteIcon>
                    </IconButton>}
                </Box>
            </Toolbar>
        </Box>
        <Box className="player-lyric-content">
            <ReactLRC
                lrc={LrcInfo?.lrc || '[00:00]暂无歌词，请欣赏'}
                currentMillisecond={duration * 1000}
                verticalSpace={true}
                lineRenderer={({ active, line: { content } }) => (
                    active ? <span className="lrc-line lrc-line-active">{content}</span> : <span className="lrc-line">{content}</span>
                )}
            />
        </Box>
    </div>
}

LyricViewer.propTypes = {
    onToggleLyricView: PropTypes.func,
    height: PropTypes.number,
    duration: PropTypes.number,
}

export default LyricViewer