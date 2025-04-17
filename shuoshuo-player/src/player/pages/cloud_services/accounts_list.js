import {
    Box, TableContainer, Table, TableHead, TableRow, Dialog,
    DialogContent, DialogActions, Pagination, TableCell, TableBody, Typography,
    Stack, IconButton, DialogTitle, Grid, InputBase, Paper
} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {CloudServiceUserRoleNameMap, CommonPagerObject, CommonPagerParams, NoticeTypes} from "@/constants";
import {useDispatch} from "react-redux";
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";

const AccountListPage = () => {
    const dispatch = useDispatch();
    const [accountViewOpen, setAccountViewOpen] = useState(false);
    const [accountInfo, setAccountInfo] = useState(null);
    const [accountList, setAccountList] = useState([]);
    const [accountSearchKeyword, setAccountSearchKeyword] = useState('');
    const [accountQueryParams, setAccountQueryParams] = useState({
        keyword: '',
        ...CommonPagerParams
    });
    const [accountListPager, setAccountListPager] = useState({...CommonPagerObject});

    const accountListPageCount = useMemo(() => {
        return Math.ceil(accountListPager.total / accountListPager.page_size);
    }, [accountListPager])

    useEffect(() => {
        API.CloudService.Account.Manage.getAccountsList({
            params: {
                ...accountQueryParams,
            }
        }).then(res => {
            setAccountList(res?.list ?? []);
            setAccountListPager(res?.pager ?? {});
        }).catch((err) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: err?.message,
                duration: 3000,
            }));
        })
    }, [dispatch, accountQueryParams]);


    // 打开修改账号弹层
    const handleShowAccount = (row) => {
        setAccountInfo(row);
        setAccountViewOpen(true);
    }

    // 刷新列表
    const handleRefreshList = () => {
        setAccountQueryParams({...accountQueryParams})
    }

    // 切换分页
    const handlePageChange = (e, page) => {
        setAccountQueryParams({
            page: page,
            limit: accountQueryParams.limit,
        })
    }

    const handleSearch = () => {
        setAccountQueryParams({...accountQueryParams, page: 1, keyword: accountSearchKeyword})
    }

    // 删除还在那更好
    const handleDeleteAccount = (e, row) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除当前账号吗？操作不可逆！')) return;
        API.CloudService.Account.Manage.deleteAccount(row.bvid)({}).then(res => {
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

    const handleCloseAccount = () => {
        setAccountViewOpen(false);
    }

    const headCells = [
        {
            id: 'user_name',
            label: '用户名',
        },
        {
            id: 'email',
            align: 'left',
            label: 'Email',
        },
        {
            id: 'role',
            label: '身份',
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
            <Grid item xs={8}>
            </Grid>
            <Grid item xs={4}>
                <Paper
                    component="form"
                    sx={{ p: '2px 8px', display: 'flex', alignItems: 'center' }}
                >
                    <InputBase
                        value={accountSearchKeyword}
                        sx={{ flex: 1 }}
                        onChange={(e) => setAccountSearchKeyword(e.target.value)}
                        onKeyDown={(e) => (e.key === 'Enter' && handleSearch())}
                        placeholder="搜索账号(用户名/邮箱)"
                        inputProps={{ 'aria-label': '搜索账号(用户名/邮箱)' }}
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
                    {accountList.map((row) => {
                        return (
                            <TableRow hover key={row.id} sx={{ cursor: 'pointer' }} onClick={(e) => handleShowAccount(row)}>
                                <TableCell>
                                    <Typography variant="body2">{row.user_name}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{row.email}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{CloudServiceUserRoleNameMap[row.role] ?? '未知'}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton size="small" onClick={(e) => handleDeleteAccount(e, row)}>
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
        <Pagination count={accountListPageCount} onChange={handlePageChange} showFirstButton showLastButton />
        <Dialog
            open={accountViewOpen}
            onClose={handleCloseAccount}
            scroll="paper"
            maxWidth="sm"
            fullWidth={true}
        >
            <DialogTitle>修改账号</DialogTitle>
            <IconButton
                aria-label="close"
                onClick={handleCloseAccount}
                sx={(theme) => ({
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon />
            </IconButton>
            <DialogContent>

            </DialogContent>
            <DialogActions>

            </DialogActions>
        </Dialog>
    </Box>
}

export default AccountListPage;