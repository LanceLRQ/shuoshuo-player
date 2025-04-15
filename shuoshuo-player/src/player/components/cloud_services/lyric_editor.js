import React, {useEffect, useMemo, useCallback} from 'react';
import {
    Grid, Box, Chip, IconButton, Toolbar, Typography,
    ButtonGroup, Button, Divider
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LRCSearchDialog from "@player/dialogs/lrc_search";
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";
import isElectron from "is-electron";
import {useDispatch, useSelector} from "react-redux";
import {LyricSlice} from "@/store/lyric";
import { Lrc as LrcKit } from 'lrc-kit';
import LyricEditorTable from "@player/components/cloud_services/lyric_editor_table";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import BackupIcon from '@mui/icons-material/Backup';
import CloseIcon from "@mui/icons-material/Close";
import {CheckCloudUserPermission, formatTimeLyric} from "@/utils";
import {CloudServiceSlice} from "@/store/cloud_service";
import {CloudServiceUserRole, NoticeTypes} from "@/constants";
import {PlayerNoticesSlice} from "@/store/ui";

const LyricEditor = (props) => {
    const { currentMusic, setEditorMode, duration } = props;

    const dispatch = useDispatch();

    const inElectron = isElectron();
    const [currentLyric, setCurrentLyric] = React.useState([]);
    const [suggestedLyrics, setSuggestedLyrics] = React.useState([]);
    const [currentLyricSelected, setCurrentLyricSelected] = React.useState([]);
    const [suggestedLyricSelected, setSuggestedLyricSelected] = React.useState([]);

    const cloudServiceAccount = useSelector(CloudServiceSlice.selectors.account);
    const isCloudServiceAdmin = useMemo(() => {
        return CheckCloudUserPermission(cloudServiceAccount, CloudServiceUserRole.WebMaster | CloudServiceUserRole.Admin);
    }, [cloudServiceAccount])

    const LrcInfos = useSelector(LyricSlice.selectors.lyricMaps)
    const LrcInfo = useMemo(() => {
        if (!currentMusic) return {};
        return LrcInfos[currentMusic.bvid]?? {};
    }, [currentMusic, LrcInfos]);

    useEffect(() => {
        if (LrcInfo) {
            const lrcP = LrcKit.parse(LrcInfo.lrc);
            setCurrentLyric(lrcP.lyrics);
        } else {
            setCurrentLyric([])
        }
    }, [LrcInfo])

    const handleSaveLyric = useCallback(() => {
        const lrcParser = new LrcKit();
        currentLyric.forEach((lrc) => {
            lrcParser.lyrics.push(lrc)
        });
        const lrcResp = lrcParser.toString({combine: false});
        dispatch(LyricSlice.actions.updateLyric({
            bvid: currentMusic.bvid,
            lrc: lrcResp.replace(/\r\n/g, '\n'),
            offset: 0,
            source: '',
        }));
        dispatch(PlayerNoticesSlice.actions.sendNotice({
            type: NoticeTypes.SUCCESS,
            message: `修改成功`,
            duration: 1000,
        }));
        setEditorMode(false);
    }, [dispatch, currentMusic, currentLyric, setEditorMode]);

    const handleReceiveSuggestLyric = useCallback((lrc) => {
        const lrcParser = LrcKit.parse(lrc);
        setSuggestedLyrics(lrcParser.lyrics)
    }, [setSuggestedLyrics]);

    const handleUpdateLyric = useCallback((rowIndex, lyrics) => {
        currentLyric[rowIndex] = lyrics;
        setCurrentLyric(currentLyric);
    }, [currentLyric, setCurrentLyric])

    const handleDeleteLyric = useCallback((targets) => {
        let ret = [...currentLyric];
        if (targets === 'all') {
            if (!window.confirm('确定要删除所有歌词吗？')) return
            ret = [];
        } else {
            if (!window.confirm('确定要删除所选歌词吗？')) return
            ret = ret.filter((_, index) => !currentLyricSelected.includes(index));
        }
        setCurrentLyric(ret);
        setCurrentLyricSelected([]);
    }, [currentLyric, setCurrentLyric, currentLyricSelected, setCurrentLyricSelected])

    const handleInsertLyric = useCallback((targets) => {
        let ret = [...currentLyric];
        if (targets === 'current') {
            ret.push({
                content: '',
                timestamp: duration
            })
        } else if (targets === 'suggested') {
            suggestedLyricSelected.forEach((index) => {
                ret.push(suggestedLyrics[index])
            })
        }
        ret.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
        setCurrentLyric(ret);
        setSuggestedLyricSelected([]);
    }, [
        duration, currentLyric, setCurrentLyric, suggestedLyrics,
        suggestedLyricSelected, setSuggestedLyricSelected
    ]);

    const handleSaveToCloud = () => {

    }

    return <>
        <Box className="player-lyric-top-bar" sx={{flexGrow: 1}}>
            <Toolbar>
                <IconButton size="large" aria-label="close lyric" sx={{mr: 2}} onClick={() => setEditorMode(false)}>
                    <ArrowBackIcon/>
                </IconButton>
                <Typography noWrap={true} variant="h6" component="div" sx={{flexGrow: 1}}>
                    <Chip label="编辑歌词" /> {currentMusic?.name}
                </Typography>
                <Box sx={{display: {xs: 'none', md: 'flex'}}}>
                    {inElectron && isCloudServiceAdmin && <IconButton onClick={handleSaveToCloud}>
                        <BackupIcon></BackupIcon>
                    </IconButton>}
                    {inElectron ? <LRCSearchDialog onLyricResponse={handleReceiveSuggestLyric}>
                        {(slot) => {
                            return <IconButton onClick={() => slot.handleOpen(currentMusic?.name ?? '')}>
                                <SearchIcon/>
                            </IconButton>
                        }}
                    </LRCSearchDialog> : <IconButton onClick={() => alert('参考歌词功能只支持PC版本')}>
                        <SearchIcon/>
                    </IconButton>}
                    {<IconButton onClick={handleSaveLyric}>
                        <SaveIcon></SaveIcon>
                    </IconButton>}
                </Box>
            </Toolbar>
        </Box>
        <Grid container spacing={2}>
            <Grid item xs={6}>
                <Typography variant="h6" align="center">当前歌词</Typography>
            </Grid>
            <Grid item xs={2}></Grid>
            <Grid item xs={4}>
                <Typography variant="h6" align="center">参考歌词</Typography>
            </Grid>
        </Grid>
        <Box className="player-lyric-content">
            <Grid container spacing={2} className="player-lyric-editor">
                <Grid item xs={6} className="player-lyric-editor-left">
                    <LyricEditorTable
                        onUpdate={handleUpdateLyric}
                        selectedRows={currentLyricSelected}
                        onSelectChange={setCurrentLyricSelected}
                        lyrics={currentLyric}
                        currentPlaying={duration}
                    />
                </Grid>
                <Grid item xs={2}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6">参考歌词</Typography>
                        <ButtonGroup
                            orientation="vertical"
                            aria-label="歌词操作"
                            variant="text"
                        >
                            <Button
                                disabled={!suggestedLyricSelected.length}
                                onClick={() => {handleInsertLyric('suggested');}}
                            >
                                <KeyboardDoubleArrowLeftIcon fontSize="small" /> 插入所选行
                            </Button>
                        </ButtonGroup>
                    </Box>
                    <Divider />
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="h6">当前歌词</Typography>
                        <ButtonGroup
                            orientation="vertical"
                            aria-label="歌词操作"
                            variant="text"
                        >
                            <Button onClick={() => {handleInsertLyric('current');}}>
                                <KeyboardArrowLeftIcon fontSize="small" /> 插入空白行
                                <br />{formatTimeLyric(duration)}
                            </Button>
                            <Button
                                color="warning"
                                disabled={!currentLyricSelected.length}
                                onClick={() => {handleDeleteLyric('current');}}
                            >
                                <CloseIcon fontSize="small" /> 删除所选
                            </Button>
                            <Button
                                color="error"
                                onClick={() => {handleDeleteLyric('all');}}
                            >
                                <DeleteForeverIcon fontSize="small" /> 清空歌词
                            </Button>
                        </ButtonGroup>
                    </Box>
                </Grid>
                <Grid item xs={4} className="player-lyric-editor-right">
                    <LyricEditorTable
                        readonly
                        lyrics={suggestedLyrics}
                        selectedRows={suggestedLyricSelected}
                        onSelectChange={setSuggestedLyricSelected}
                        currentPlaying={duration}
                    />
                </Grid>
            </Grid>
        </Box>
    </>
}

export default LyricEditor;