import {
    Box, TableContainer, Table, TableHead, TableRow, Pagination, Button, InputBase,
    TableCell, TableBody, Typography, Stack, IconButton, Avatar, Grid, Paper
} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {CommonPagerObject, CommonPagerParams, NoticeTypes} from "@/constants";
import {useDispatch} from "react-redux";
import ClearIcon from '@mui/icons-material/Clear';
import {formatTimeStampFromServer, getBilibiliMidByURL} from "@/utils";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";

const LiveSlicerMenListPage = () => {
    const dispatch = useDispatch();
    const [lsmSearchKeyword, setLSMSearchKeyword] = useState('');
    const [lsmAddInput, setLSMAddInput] = useState('');
    const [liveSlicerMenList, setLiveSlicerMenList] = useState([]);
    const [liveSlicerManQueryParams, setLiveSlicerManQueryParams] = useState({
        keyword: "",
        ...CommonPagerParams,
    });
    const [liveSlicerMenListPager, setLiveSlicerMenListPager] = useState({...CommonPagerObject});

    const liveSlicerMenListPageCount = useMemo(() => {
        return Math.ceil(liveSlicerMenListPager.total / liveSlicerMenListPager.page_size);
    }, [liveSlicerMenListPager])

    useEffect(() => {
        API.CloudService.LiveSlicerMen.getLiveSlicerMenList({
            params: {
                ...liveSlicerManQueryParams
            }
        }).then(res => {
            setLiveSlicerMenList(res?.list ?? []);
            setLiveSlicerMenListPager(res?.pager ?? {});
        }).catch((err) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: err?.message,
                duration: 3000,
            }));
        })
    }, [dispatch, liveSlicerManQueryParams]);


    // 刷新列表
    const handleRefreshList = () => {
        setLiveSlicerManQueryParams({...liveSlicerManQueryParams})
    }

    // 切换分页
    const handlePageChange = (e, page) => {
        setLiveSlicerManQueryParams({
            page: page,
            limit: liveSlicerManQueryParams.limit,
        })
    }

    // 删除歌词
    const handleDeleteLiveSlicerMan = (row) => {
        if (!window.confirm('确定要删除这个切片Man吗？')) return;
        API.CloudService.LiveSlicerMen.deleteLiveSlicerMan(row.bvid)({}).then(res => {
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

    // 搜索
    const handleSearch = () => {
        setLiveSlicerManQueryParams({...liveSlicerManQueryParams, page: 1, keyword: lsmSearchKeyword})
    }

    // 更新切片man信息
    const handleUpdateLiveSlicerMan = (mid, recordId) => {
        API.Bilibili.UserApi.getUserSpaceInfo({
            params: {mid}
        }).then((res) => {
            const name = res?.name;
            const face = res.face;
            API.CloudService.LiveSlicerMen.updateLiveSlicerMan(recordId ||'')({
                data: {mid, name, face},
            }).then((res)=> {
                dispatch(PlayerNoticesSlice.actions.sendNotice({
                    type: NoticeTypes.SUCCESS,
                    message: '更新成功',
                    duration: 1000,
                }));
                setLSMAddInput('');
                handleRefreshList();
            }).catch(e => {
                dispatch(PlayerNoticesSlice.actions.sendNotice({
                    type: NoticeTypes.WARN,
                    message: '更新失败',
                    duration: 3000,
                }));
            });
        }).catch(e => {
            console.log(e);
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.WARN,
                message: '该B站用户不存在',
                duration: 3000,
            }));
        });
    }


    const handleAddOrUpdateLiveSlicerMen = () => {
        const mid = getBilibiliMidByURL(lsmAddInput);
        if (!mid || !/^\d+$/.test(String(mid))) {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.WARN,
                message: 'UID解析错误',
                duration: 2000,
            }));
            return;
        }
        handleUpdateLiveSlicerMan(mid);
    }

    const headCells = [
        {
            id: 'mid',
            label: 'MID',
        },
        {
            id: 'face',
            align: 'left',
            label: 'B站头像',
        },
        {
            id: 'name',
            align: 'left',
            label: 'B站昵称',
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

    return <Box>
        <Grid container spacing={2}>
            <Grid item xs={6}>
                <Paper
                    component="form"
                    sx={{ p: '2px 8px', display: 'flex', alignItems: 'center' }}
                >
                    <InputBase
                        value={lsmAddInput}
                        sx={{ ml: 1, flex: 1 }}
                        onChange={(e) => setLSMAddInput(e.target.value)}
                        onKeyDown={(e) => (e.key === 'Enter' && handleAddOrUpdateLiveSlicerMen())}
                        title="切片Man的B站ID或者空间地址(e.g. https://space.bilibili.com/283886865 或 283886865)"
                        placeholder="切片Man的B站ID或者空间地址(e.g. https://space.bilibili.com/283886865 或 283886865)"
                        inputProps={{ 'aria-label': '切片Man的B站ID或者空间地址' }}
                    />
                    <Button onClick={handleAddOrUpdateLiveSlicerMen}>
                        <AddIcon /> 添加
                    </Button>
                </Paper>
            </Grid>
            <Grid item xs={2}></Grid>
            <Grid item xs={4}>
                <Paper
                    component="form"
                    sx={{ p: '2px 8px', display: 'flex', alignItems: 'center' }}
                >
                    <InputBase
                        value={lsmSearchKeyword}
                        sx={{ ml: 1, flex: 1 }}
                        onChange={(e) => setLSMSearchKeyword(e.target.value)}
                        onKeyDown={(e) => (e.key === 'Enter' && handleSearch())}
                        placeholder="搜索切片Man的B站昵称等"
                        inputProps={{ 'aria-label': '搜索切片Man' }}
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
                    {liveSlicerMenList.map((row) => {
                        return (
                            <TableRow hover key={row.id} sx={{ cursor: 'pointer' }}>
                                <TableCell>
                                    <Typography variant="body2" noWrap>{row?.mid}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Avatar src={row?.face} sx={{width: 48, height: 48}}></Avatar>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{row?.name}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" noWrap>
                                        {formatTimeStampFromServer(row.update_time ?? 0)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton size="small" onClick={() => handleUpdateLiveSlicerMan(row?.mid, row?.id)}>
                                            <RefreshIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleDeleteLiveSlicerMan(row)}>
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
        <Pagination count={liveSlicerMenListPageCount} onChange={handlePageChange} showFirstButton showLastButton />
    </Box>
}

export default LiveSlicerMenListPage;