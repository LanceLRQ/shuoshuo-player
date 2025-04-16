import {
    Box, TableContainer, Table, TableHead, TableRow, Dialog, DialogContent, DialogActions,
    TableCell, TableBody, Typography, Stack, IconButton, DialogTitle, Button, ListItem, ListItemText, List
} from "@mui/material";
import React, {useEffect, useState} from "react";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {NoticeTypes} from "@/constants";
import {useDispatch} from "react-redux";
import HistoryIcon from '@mui/icons-material/History';
import ClearIcon from '@mui/icons-material/Clear';
import {formatMillisecond, formatTimeStampFromServer} from "@/utils";
import {Lrc as ReactLRC} from "react-lrc";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";

export const LyricListPage = () => {
    const dispatch = useDispatch();
    const [lyricViewOpen, setLyricViewOpen] = useState(false);
    const [lyricViewMode, setLyricViewMode] = useState('view');
    const [lyricViewInfo, setLyricViewInfo] = useState(null);
    const [lyricViewHistory, setLyricViewHistory] = useState([]);
    const [lyricViewSnapInfo, setLyricViewSnapInfo] = useState(null);
    const [lyricList, setLyricList] = useState([]);
    const [lyricQueryParams, setLyricQueryParams] = useState({
        page: 1,
        limit: 20,
    });
    const [lyricListPager, setLyricListPager] = useState({
        page: 1,
        page_size: 20,
        total: 0,
    });

    useEffect(() => {
        API.CloudService.Lyric.getLyricList({
            params: {
                page: lyricQueryParams.page,
                limit: lyricQueryParams.limit,
            }
        }).then(res => {
            setLyricList(res?.list ?? []);
            setLyricListPager(res?.pager ?? {});
        }).catch((err) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: err?.message,
                duration: 3000,
            }));
        })
    }, [dispatch, lyricQueryParams]);


    // 显示歌词
    const handleShowLyric = (row) => {
        setLyricViewMode('view');
        setLyricViewSnapInfo(null);
        setLyricViewInfo(row);
        setLyricViewOpen(true);
    }

    // 显示歌词快照列表（10个）
    const handleShowHistory = (e, row) => {
        e.stopPropagation();
        API.CloudService.Lyric.getLyricHistory(row.bvid)({}).then(res => {
            setLyricViewHistory(res || []);
            setLyricViewMode('history');
            setLyricViewSnapInfo(null);
            setLyricViewInfo(row);
            setLyricViewOpen(true);
        }).catch((err) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: err?.message,
                duration: 3000,
            }));
        })
    }
    // 显示歌词
    const handleDeleteLyric = (e, row) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除当前视频关联的歌词信息吗？')) return;
        API.CloudService.Lyric.getLyricHistory(row.bvid)({}).then(res => {
            // 触发列表刷新
            setLyricQueryParams({
                page: lyricQueryParams.page,
                limit: lyricQueryParams.limit,
            })
        }).catch((err) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: err?.message,
                duration: 3000,
            }));
        })
    }

    const handleCloseLyric = () => {
        setLyricViewOpen(false);
    }

    const headCells = [
        {
            id: 'bvid',
            label: 'BV号',
        },
        {
            id: 'title',
            align: 'left',
            label: '视频标题',
        },
        {
            id: 'create_time',
            label: '创建时间',
        },
        {
            id: 'update_time',
            label: '更新时间',
        },
        {
            id: 'operate',
            label: '操作',
        },
    ];


    const renderDialogLrcView = () => {
        let content = lyricViewSnapInfo ? (lyricViewSnapInfo?.content ?? '') : (lyricViewInfo?.content ?? '')
        return  <>
            <DialogContent dividers sx={{maxHeight: 450}}>
                <ReactLRC
                    lrc={content}
                    lineRenderer={({ line }) => (
                        <p key={line.startMillisecond}>
                            <strong>
                                {formatMillisecond(line.startMillisecond)}
                            </strong>
                            &nbsp;
                            {line.content}
                        </p>
                    )}
                />
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={() =>
                    lyricViewSnapInfo ? setLyricViewMode('history') : handleCloseLyric()
                }>
                    {lyricViewSnapInfo ? '返回' : '关闭'}
                </Button>
            </DialogActions>
        </>
    }

    const renderDialogHistoryList = () => {
        return <>
            <DialogContent dividers  sx={{maxHeight: 450}}>
                <List>
                    {lyricViewHistory.map((item) => (<ListItem
                        key={item.id}
                        onClick={() => {
                            setLyricViewSnapInfo(item);
                            setLyricViewMode('view');
                        }}
                        sx={{ cursor: 'pointer' }}
                        secondaryAction={<KeyboardArrowRightIcon />}
                    >
                        <ListItemText
                            sx={{textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}
                            secondary={
                                <Typography variant="body2" component="span" noWrap>
                                    创建者：{item?.author?.user_name ?? '管理员'}
                                </Typography>
                            }
                        >
                            快照 {formatTimeStampFromServer(item?.create_time ?? 0)}
                        </ListItemText>
                    </ListItem>))}
                </List>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={handleCloseLyric}>关闭</Button>
            </DialogActions>
        </>
    }

    return <Box>
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {headCells.map((headCell) => {
                            return <TableCell
                                key={headCell.id}
                                align={headCell.align}
                            >
                                {headCell.label}
                            </TableCell>
                        })}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {lyricList.map((row) => {
                        return (
                            <TableRow hover key={row.id} sx={{ cursor: 'pointer' }} onClick={(e) => handleShowLyric(row)}>
                                <TableCell>
                                    <Typography variant="body2" noWrap>{row.bvid}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{row.title}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" noWrap>
                                        {formatTimeStampFromServer(row.create_time ?? 0)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" noWrap>
                                        {formatTimeStampFromServer(row.update_time ?? 0)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton size="small" onClick={(e) => handleShowHistory(e, row)}>
                                            <HistoryIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={(e) => handleDeleteLyric(e, row)}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
        <Dialog
            open={lyricViewOpen}
            onClose={handleCloseLyric}
            scroll="paper"
            maxWidth="sm"
            fullWidth={true}
        >
            <DialogTitle>{lyricViewMode === 'history' ? `歌词快照(${lyricViewHistory.length})` : `歌词内容${lyricViewSnapInfo ? `(快照 ${formatTimeStampFromServer(lyricViewSnapInfo.create_time ?? 0)})` : ''}`}</DialogTitle>
            <IconButton
                aria-label="close"
                onClick={handleCloseLyric}
                sx={(theme) => ({
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon />
            </IconButton>
            {lyricViewMode === 'history' ? renderDialogHistoryList() : renderDialogLrcView()}
        </Dialog>
    </Box>
}