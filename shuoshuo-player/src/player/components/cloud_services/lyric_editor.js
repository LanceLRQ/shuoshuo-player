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
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import BackupIcon from '@mui/icons-material/Backup';
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import UndoIcon from '@mui/icons-material/Undo';
import DownloadIcon from '@mui/icons-material/Download';
import {
    CheckCloudUserPermission,
    createLyricFileLoader,
    filterInvalidFileNameChars,
    formatTimeLyric,
    textToDownload
} from "@/utils";
import {CloudServiceSlice} from "@/store/cloud_service";
import {CloudServiceUserRole, NoticeTypes} from "@/constants";
import {PlayerNoticesSlice} from "@/store/ui";
import API from "@/api";

const LyricEditor = (props) => {
    const { currentMusic, setEditorMode, duration } = props;

    const dispatch = useDispatch();

    const inElectron = isElectron();
    const [currentLyric, setCurrentLyric] = React.useState([]);
    const [suggestedLyrics, setSuggestedLyrics] = React.useState([]);
    const [currentLyricSelected, setCurrentLyricSelected] = React.useState([]);
    const [suggestedLyricSelected, setSuggestedLyricSelected] = React.useState([]);
    const [editHistory, setEditHistory] = React.useState([]);
    const [lyricsChanged, setLyricsChanged] = React.useState(false);
    const isDebug = process.env.NODE_ENV === 'development';

    const isCloudServiceLogin = useSelector(CloudServiceSlice.selectors.isLogin);
    const cloudServiceAccount = useSelector(CloudServiceSlice.selectors.account);
    const isCloudServiceAdmin = useMemo(() => {
        if (!isCloudServiceLogin) return false;
        return CheckCloudUserPermission(cloudServiceAccount, CloudServiceUserRole.WebMaster | CloudServiceUserRole.Admin);
    }, [cloudServiceAccount, isCloudServiceLogin])

    const LrcInfos = useSelector(LyricSlice.selectors.lyricMaps)
    const LrcInfo = useMemo(() => {
        if (!currentMusic) return {};
        return LrcInfos[currentMusic.bvid]?? {};
    }, [currentMusic, LrcInfos]);

    useEffect(() => {
        if (LrcInfo) {
            const lrcP = LrcKit.parse(LrcInfo?.lrc ?? '');
            setCurrentLyric(lrcP.lyrics);
        } else {
            setCurrentLyric([])
        }
    }, [LrcInfo])

    // 创建一条历史编辑记录
    const pushHistory = useCallback((lyrics) => {
        const ret = [...editHistory, JSON.parse(JSON.stringify(lyrics))];
        if (ret.length > 999) {
            ret.shift();
        }
        setEditHistory(ret);
        setLyricsChanged(true);
    }, [editHistory, setEditHistory, setLyricsChanged]);

    // 保存歌词到本地
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
            message: `保存成功`,
            duration: 1000,
        }));
        setLyricsChanged(false)
    }, [dispatch, currentMusic, currentLyric, setLyricsChanged]);

    // 设置参考歌词的数据
    const handleReceiveSuggestLyric = useCallback((lrc) => {
        const lrcParser = LrcKit.parse(lrc);
        setSuggestedLyrics(lrcParser.lyrics)
    }, [setSuggestedLyrics]);

    // 接收表格组件的歌词内容更新
    const handleUpdateLyric = useCallback((rowIndex, lyrics) => {
        pushHistory(currentLyric);
        currentLyric[rowIndex] = lyrics;
        setCurrentLyric(currentLyric);
    }, [currentLyric, setCurrentLyric, pushHistory])

    // 删除歌词
    const handleDeleteLyric = useCallback((targets) => {
        let ret = [...currentLyric];
        if (targets === 'all') {
            if (!window.confirm('确定要删除所有歌词吗？')) return
            ret = [];
        } else {
            if (!window.confirm('确定要删除所选歌词吗？')) return
            ret = ret.filter((_, index) => !currentLyricSelected.includes(index));
        }
        pushHistory(currentLyric);
        setCurrentLyric(ret);
        setCurrentLyricSelected([]);
    }, [currentLyric, setCurrentLyric, currentLyricSelected, setCurrentLyricSelected, pushHistory])

    // 插入歌词
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
        pushHistory(currentLyric);
        setCurrentLyric(ret);
        setSuggestedLyricSelected([]);
    }, [
        duration, currentLyric, setCurrentLyric, suggestedLyrics,
        suggestedLyricSelected, setSuggestedLyricSelected, pushHistory
    ]);

    // 歌词前后移动
    const handleOffsetChange = useCallback((offset) => {
        let ret = [...currentLyric];
        ret = ret.map((item, index) => {
            if (currentLyricSelected.length > 0 && !currentLyricSelected.includes(index)) {
                return item;
            }
            const val = item?.timestamp + offset;
            return {
                ...item,
                timestamp: val < 0 ? 0 : val,
            }
        })
        pushHistory(currentLyric);
        setCurrentLyric(ret);
    }, [currentLyric, setCurrentLyric, currentLyricSelected, pushHistory])

    //保存当前歌词到云端(管理员用)
    const handleSaveToCloud = useCallback(() => {
        if (lyricsChanged) {
            alert('歌词内容有改动，请先保存');
            return;
        }
        if (!window.confirm('确定要将当前歌词内容更新到云服务数据库吗？\n操作将覆盖对应歌曲的歌词内容，请谨慎操作！')) return
        const lrcParser = new LrcKit();
        currentLyric.forEach((lrc) => {
            lrcParser.lyrics.push(lrc)
        });
        const lrcResp = lrcParser.toString({combine: false});
        API.CloudService.Lyric.saveLyric(currentMusic.bvid)({
            data: {
                content: lrcResp.replace(/\r\n/g, '\n'),
                title: currentMusic.name,
            }
        }).then((res) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.SUCCESS,
                message: `云端歌词更新成功`,
                duration: 2000,
            }));
        }).catch((err) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: err?.message,
                duration: 3000,
            }));
        })
    }, [dispatch, currentLyric, lyricsChanged, currentMusic])

    // 撤销一步操作
    const handleUndoClick = useCallback(() => {
        if (editHistory.length > 0) {
            const ret = [...editHistory];
            const data = ret.pop()
            setCurrentLyric(data);
            setEditHistory(ret);
            setLyricsChanged(true)
        }
    }, [setCurrentLyric, editHistory, setEditHistory, setLyricsChanged])

    // 关闭编辑器
    const handleCloseEditor = useCallback(() => {
        if (lyricsChanged && !window.confirm('确定要返回吗？未保存的改动将丢失')) {
            return;
        }
        setLyricsChanged(false)
        setEditorMode(false)
    }, [setEditorMode, lyricsChanged, setLyricsChanged])

    // 从文件解析歌词
    const handleLoadLyricsFromFile = useCallback(() => {
        createLyricFileLoader((result) => {
            try {
                const lrcParser = LrcKit.parse(result.replace(/\r\n/g, '\n'));
                setSuggestedLyrics(lrcParser.lyrics)
            } catch (e) {
                alert('无法解析歌词文件，请检查格式是否正确');
            }
        })
    }, [setSuggestedLyrics]);

    const handleSaveLyricToFile = useCallback(() => {
        const lrcParser = new LrcKit();
        currentLyric.forEach((lrc) => {
            lrcParser.lyrics.push(lrc)
        });
        const lrcResp = lrcParser.toString({combine: false});
        textToDownload(lrcResp, `${filterInvalidFileNameChars(currentMusic.name)}.lrc`)
    }, [currentLyric, currentMusic]);

    return <>
        <Box className="player-lyric-top-bar" sx={{flexGrow: 1}}>
            <Toolbar>
                <IconButton size="large" aria-label="close lyric" sx={{mr: 2}} onClick={handleCloseEditor}>
                    <ArrowBackIcon/>
                </IconButton>
                <Typography noWrap={true} variant="h6" component="div" sx={{flexGrow: 1}}>
                    <Chip label="编辑歌词" /> {currentMusic?.name}
                </Typography>
                <Box sx={{display: {xs: 'none', md: 'flex'}}}>
                    {inElectron ? <LRCSearchDialog onLyricResponse={handleReceiveSuggestLyric}>
                        {(slot) => {
                            return <IconButton title="搜索参考歌词(QQ音乐)" onClick={() => slot.handleOpen(currentMusic?.name ?? '')}>
                                <SearchIcon/>
                            </IconButton>
                        }}
                    </LRCSearchDialog> : <IconButton title="搜索参考歌词(QQ音乐)" onClick={() => alert('参考歌词功能只支持PC版本')}>
                        <SearchIcon/>
                    </IconButton>}
                    <IconButton onClick={handleLoadLyricsFromFile} title="从文件加载参考歌词">
                        <UploadFileIcon />
                    </IconButton>
                    {inElectron && isCloudServiceAdmin && <IconButton title="上传到云端(管理员)" onClick={handleSaveToCloud}>
                        <BackupIcon></BackupIcon>
                    </IconButton>}
                    <IconButton onClick={handleSaveLyric} title="保存歌词修改">
                        <SaveIcon></SaveIcon>
                    </IconButton>
                    {isDebug && <IconButton onClick={handleSaveLyricToFile} title="下载当前歌词(调试)">
                        <DownloadIcon></DownloadIcon>
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
                            <Button onClick={() => {handleOffsetChange(-0.5);}}>
                                <RemoveIcon fontSize="small" /> {currentLyricSelected.length > 0 ?'选中' : '整体'}前移0.5秒
                            </Button>
                            <Button onClick={() => {handleOffsetChange(0.5);}}>
                                <AddIcon fontSize="small" />  {currentLyricSelected.length > 0 ?'选中' : '整体'}后移0.5秒
                            </Button>
                            <Button disabled={!editHistory.length} onClick={handleUndoClick}>
                                <UndoIcon fontSize="small" />  撤销一步操作
                            </Button>
                            <Button disabled={currentLyricSelected.length === 0} onClick={() => {setCurrentLyricSelected([])}}>
                                <PlaylistRemoveIcon fontSize="small" />  取消选择
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
                                <DeleteSweepIcon fontSize="small" /> 清空歌词
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