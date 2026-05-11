import {
    Box, TableContainer, Table, TableHead, TableRow, Dialog, DialogContent, DialogActions, Pagination,
    TableCell, TableBody, Typography, Stack, IconButton, DialogTitle, Button, ListItem, ListItemText,
    List, Grid, Paper, InputBase
} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {CommonPagerObject, CommonPagerParams, NoticeTypes} from "@/constants";
import {useDispatch} from "react-redux";
import HistoryIcon from '@mui/icons-material/History';
import ClearIcon from '@mui/icons-material/Clear';
import {formatMillisecond, formatTimeStampFromServer} from "@/utils";
import {Lrc as ReactLRC} from "react-lrc";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

const LyricListPage = () => {
    const dispatch = useDispatch();
    const [lyricSearchKeyword, setLyricSearchKeyword] = useState('');
    const [lyricViewOpen, setLyricViewOpen] = useState(false);
    const [lyricViewMode, setLyricViewMode] = useState('view');
    const [lyricViewInfo, setLyricViewInfo] = useState(null);
    const [lyricViewHistory, setLyricViewHistory] = useState([]);
    const [lyricViewSnapInfo, setLyricViewSnapInfo] = useState(null);
    const [lyricList, setLyricList] = useState([]);
    const [lyricQueryParams, setLyricQueryParams] = useState({
        keyword: '',
        ...CommonPagerParams
    });
    const [lyricListPager, setLyricListPager] = useState({...CommonPagerObject});

    const lyricListPageCount = useMemo(() => {
        return Math.ceil(lyricListPager.total / lyricListPager.page_size);
    }, [lyricListPager])

    useEffect(() => {
        API.CloudService.Lyric.getLyricList({
            params: {
                ...lyricQueryParams
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

    // 刷新列表
    const handleRefreshList = () => {
        setLyricQueryParams({...lyricQueryParams})
    }

    // 切换分页
    const handlePageChange = (e, page) => {
        setLyricQueryParams({
            page: page,
            limit: lyricQueryParams.limit,
        })
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
    // 删除歌词
    const handleDeleteLyric = (e, row) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除当前视频关联的歌词信息吗？')) return;
        API.CloudService.Lyric.deleteLyric(row.bvid)({}).then(res => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.SUCCESS,
                message: '删除成功',
                duration: 1000,
            }));
            // 触发列表刷新
            handleRefreshList();
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

    const handleSearch = () => {
        setLyricQueryParams({...lyricQueryParams, page: 1, keyword: lyricSearchKeyword})
    }

    const handleCellClick = (e) => {
        e.stopPropagation(); // 阻止事件冒泡
    };

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
            sx: { width: 100 },
            label: <Typography variant="body2">
                操作 <IconButton onClick={handleRefreshList}><RefreshIcon fontSize="small" /></IconButton>
            </Typography>,
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
        <Grid container spacing={2}>
            <Grid item xs={6}>
            </Grid>
            <Grid item xs={6}>
                <Paper
                    component="form"
                    sx={{ p: '2px 8px', display: 'flex', alignItems: 'center' }}
                >
                    <InputBase
                        value={lyricSearchKeyword}
                        sx={{ ml: 1, flex: 1 }}
                        onChange={(e) => setLyricSearchKeyword(e.target.value)}
                        onKeyDown={(e) => (e.key === 'Enter' && handleSearch())}
                        placeholder="搜索视频标题或BVID"
                        inputProps={{ 'aria-label': '搜索视频标题或BVID' }}
                    />
                    <IconButton type="button" aria-label="搜索" onClick={handleSearch}>
                        <SearchIcon />
                    </IconButton>
                </Paper>
            </Grid>
        </Grid>
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {headCells.map((headCell) => {
                            return <TableCell
                                key={headCell.id}
                                align={headCell.align}
                                sx={headCell.sx}
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
                                <TableCell onClick={handleCellClick}>
                                    <Typography variant="body2" noWrap onClick={handleCellClick}>{row.bvid}</Typography>
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
        <Pagination count={lyricListPageCount} onChange={handlePageChange} showFirstButton showLastButton />
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

export default LyricListPage;