import React, {useState, useCallback, useMemo} from 'react';
import { Typography, Box, Toolbar, IconButton, Popover } from '@mui/material';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { Lrc as ReactLRC } from "react-lrc";
import PropTypes from "prop-types";
import {useDispatch, useSelector} from "react-redux";
import {LyricSlice} from "@/store/lyric";
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from '@mui/icons-material/Remove';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import LyricEditor from "@player/components/lyric_editor";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {NoticeTypes} from "@/constants";

function LyricViewer(props) {
    const { height, onToggleLyricView, duration, currentMusic } = props;
    const dispatch = useDispatch();

    const [editorMode, setEditorMode] = useState(false);

    const [offsetPopoverEl, setOffsetPopoverEl] = useState(null)
    const handleOffsetPopoverOpen = (event) => {
        setOffsetPopoverEl(event.currentTarget);
    };
    const handleOffsetPopoverClose = () => {
        setOffsetPopoverEl(null);
    };
    const openOffsetPopover = Boolean(offsetPopoverEl);

    const LrcInfos = useSelector(LyricSlice.selectors.lyricMaps)
    const LrcInfo = useMemo(() => {
        if (!currentMusic) return {};
        return LrcInfos[currentMusic.bvid]?? {};
    }, [currentMusic, LrcInfos]);

    const coverImg = useMemo(() => {
        if (!currentMusic) return '';
        return currentMusic.cover;
    }, [currentMusic]);

    // 从云服务端拉取歌词并更新
    const handleRefreshLyricFromCloudService = () => {
        if (!currentMusic.bvid) return;
        API.CloudService.Lyric.getLyricByBvid(currentMusic.bvid)({}).then(resp => {
            const lrcContent = resp?.content;
            dispatch(LyricSlice.actions.updateLyric({
                bvid: currentMusic.bvid,
                lrc: lrcContent,
                offset: 0,
                source: '说说播放器云服务',
            }));
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.SUCCESS,
                message: `更新歌词成功`,
                duration: 1000,
            }));
        }).catch((resp) => {
            console.warn(resp.message);
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: `更新失败：${resp.message}`,
                duration: 3000,
            }));
        });
    }

    // 歌词位移（前端加减模式，不影响实际内容）
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
            duration={duration}
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
                        <IconButton title="编辑歌词" onClick={() => setEditorMode(true)}>
                            <ModeEditIcon></ModeEditIcon>
                        </IconButton>
                        <IconButton title="拉取云端歌词" onClick={handleRefreshLyricFromCloudService}>
                            <RefreshIcon></RefreshIcon>
                        </IconButton>
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