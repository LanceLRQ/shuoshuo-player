import React, {useState, useCallback, useMemo} from 'react';
import { Typography, Box, Toolbar, IconButton, Popover } from '@mui/material';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import SearchIcon from '@mui/icons-material/Search';
import { Lrc as ReactLRC } from "react-lrc";
import PropTypes from "prop-types";
import LRCSearchDialog from "@player/dialogs/lrc_search";
import isElectron from "is-electron";
import {useDispatch, useSelector} from "react-redux";
import {LyricSlice} from "@/store/lyric";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from '@mui/icons-material/Remove';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import {CloudServiceSlice} from "@/store/cloud_service";
import {CheckCloudUserPermission} from "@/utils";
import {CloudServiceUserRole} from "@/constants";
import LyricEditor from "@player/components/cloud_services/lyric_editor";

function LyricViewer(props) {
    const { height, onToggleLyricView, duration, currentMusic } = props;
    const inElectron = isElectron();
    const dispatch = useDispatch();

    const [editorMode, setEditorMode] = useState(true);

    const [offsetPopoverEl, setOffsetPopoverEl] = useState(null)
    const handleOffsetPopoverOpen = (event) => {
        setOffsetPopoverEl(event.currentTarget);
    };
    const handleOffsetPopoverClose = () => {
        setOffsetPopoverEl(null);
    };
    const openOffsetPopover = Boolean(offsetPopoverEl);

    const cloudServiceAccount = useSelector(CloudServiceSlice.selectors.account);
    const isCloudServiceAdmin = useMemo(() => {
        return CheckCloudUserPermission(cloudServiceAccount, CloudServiceUserRole.WebMaster | CloudServiceUserRole.Admin);
    }, [cloudServiceAccount])

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
            source: '',
        }));
    }

    const handleChangeDuration = useCallback((offset) => {
        dispatch(LyricSlice.actions.updateLyric({
            ...LrcInfo,
            offset: LrcInfo.offset + offset,
        }));
    }, [dispatch, LrcInfo])

    const durationWithOffset = (duration + LrcInfo.offset) * 1000;

    return <div className="player-lyric-main" style={{height: height}}>
        <div className="player-lyric-background-mask">
            <img src={coverImg} alt="cover" />
        </div>
        {editorMode && currentMusic ? <LyricEditor
            currentMusic={currentMusic}
            setEditorMode={setEditorMode}
        /> : <>
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
                        <Box
                            onMouseEnter={handleOffsetPopoverOpen}
                            onMouseLeave={handleOffsetPopoverClose}
                        >
                            <IconButton onClick={() => handleChangeDuration(-0.5)}>
                                <RemoveIcon></RemoveIcon>
                            </IconButton>
                            <IconButton onClick={() => handleChangeDuration(0.5)}>
                                <AddIcon></AddIcon>
                            </IconButton>
                        </Box>
                        <Popover
                            sx={{pointerEvents: 'none'}}
                            open={openOffsetPopover}
                            anchorEl={offsetPopoverEl}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'center',
                            }}
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'center',
                            }}
                            onClose={handleOffsetPopoverClose}
                            disableRestoreFocus
                        >
                            <Typography sx={{ p: 1 }}>当前偏移量：{LrcInfo?.offset ?? '0'}s</Typography>
                        </Popover>
                        {inElectron && isCloudServiceAdmin && <IconButton onClick={() => setEditorMode(true)}>
                            <ModeEditIcon></ModeEditIcon>
                        </IconButton>}
                        {isDebugging && <IconButton onClick={handleDebugClearLRC}>
                            <DeleteIcon></DeleteIcon>
                        </IconButton>}
                    </Box>
                </Toolbar>
            </Box>
            <Box className="player-lyric-content">
                <ReactLRC
                    lrc={LrcInfo?.lrc || '[00:00]暂无歌词，请欣赏'}
                    currentMillisecond={durationWithOffset}
                    verticalSpace={true}
                    lineRenderer={({ active, line: { content } }) => (
                        active ? <span className="lrc-line lrc-line-active">{content}</span> : <span className="lrc-line">{content}</span>
                    )}
                />
            </Box>
        </>}
    </div>
}

LyricViewer.propTypes = {
    onToggleLyricView: PropTypes.func,
    height: PropTypes.number,
    duration: PropTypes.number,
}

export default LyricViewer