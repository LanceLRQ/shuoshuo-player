import {
    Box, TableContainer, Table, TableHead, TableRow, Dialog, Button, Divider, DialogContent,
    Pagination, TableCell, TableBody, Typography, Stack, IconButton, DialogTitle, Grid, InputBase,
    Paper, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField, Checkbox, DialogActions
} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {
    CloudServiceUserRole, CloudServiceUserRoleNameMap, CommonPagerObject, CommonPagerParams, NoticeTypes
} from "@/constants";
import {useDispatch, useSelector} from "react-redux";
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import {useFormik} from "formik";
import * as yup from "yup";
import AddIcon from "@mui/icons-material/Add";
import {CheckCloudUserPermission} from "@/utils";
import {CloudServiceSlice} from "@/store/cloud_service";

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
    const isCloudServiceLogin = useSelector(CloudServiceSlice.selectors.isLogin);
    const cloudServiceAccount = useSelector(CloudServiceSlice.selectors.account);
    const hasWebMasterPermission = useMemo(() => {
        if (!isCloudServiceLogin) return false;
        return CheckCloudUserPermission(cloudServiceAccount, CloudServiceUserRole.WebMaster);
    }, [cloudServiceAccount, isCloudServiceLogin])

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


    // 刷新列表
    const handleRefreshList = () => {
        setAccountQueryParams({...accountQueryParams})
    }

    // 切换分页
    const handlePageChange = (e, page) => {
        setAccountQueryParams({
            keyword: accountQueryParams.keyword,
            page: page,
            limit: accountQueryParams.limit,
        })
    }

    const handleSearch = () => {
        setAccountQueryParams({...accountQueryParams, page: 1, keyword: accountSearchKeyword})
    }

    // 删除账号
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

    const validationSchema = yup.object({
        user_name: yup.string().max(16, '名称不能超过16个字符').required('请输入用户名'),
        email: yup.string().email('email格式不正确').required('请输入邮箱'),
        role: yup.number(),
        password: yup.string().max(20, '密码不能超过20个字符').min(8, '密码不能少于8个字符').test({
            name: 'password-for-new-account',
            test(value, ctx) {
                const { id = '' } = ctx.parent;
                if (!id && !(value || '').trim()) {
                    return ctx.createError({ message: '请填写密码' })
                }
                return true
            }
        }),
    });

    const formik = useFormik({
        initialValues: {
            id: '',
            user_name: '',
            email: '',
            role: 0,
            password: '',
            reset_password_lock: false
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {
            if (!accountInfo) {
                // 新增
                API.CloudService.Account.Manage.addAccount({
                    data: values,
                }).then((res) => {
                    dispatch(PlayerNoticesSlice.actions.sendNotice({
                        type: NoticeTypes.SUCCESS,
                        message: '创建账号成功',
                        duration: 3000,
                    }));
                    setAccountQueryParams({ ...accountQueryParams, keyword: ''});
                    handlePageChange(null, 1);
                    handleCloseAccount();
                }).catch(err => {
                    dispatch(PlayerNoticesSlice.actions.sendNotice({
                        type: NoticeTypes.ERROR,
                        message: err?.message,
                        duration: 3000,
                    }));
                })
            } else {
                // 修改
                API.CloudService.Account.Manage.editAccount(accountInfo.id)({
                    data: values,
                }).then((res) => {
                    dispatch(PlayerNoticesSlice.actions.sendNotice({
                        type: NoticeTypes.SUCCESS,
                        message: '修改账号成功',
                        duration: 3000,
                    }));
                    handleRefreshList();
                    handleCloseAccount();
                }).catch(err => {
                    dispatch(PlayerNoticesSlice.actions.sendNotice({
                        type: NoticeTypes.ERROR,
                        message: err?.message,
                        duration: 3000,
                    }));
                })
            }
        }
    });

    // 打开修改账号弹层
    const handleShowAccount = (row) => {
        if (row) {
            setAccountInfo(row);
            formik.resetForm({
                values: {
                    id: row.id,
                    user_name: row.user_name,
                    email: row.email,
                    role: row.role,
                    password: row.password,
                    reset_password_lock: false,
                }
            })
        } else {
            setAccountInfo(null);
            formik.resetForm({
                values: {
                    id: '',
                    role: 0
                }
            })
        }
        setAccountViewOpen(true);
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
                    <Button onClick={() => handleShowAccount()}>
                        <AddIcon /> 添加账号
                    </Button>
                    <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
                    <InputBase
                        value={accountSearchKeyword}
                        sx={{ ml: 1, flex: 1 }}
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
            <DialogTitle>{accountInfo ? '编辑账户' : '添加账户'}</DialogTitle>
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
                <CloseIcon/>
            </IconButton>
            <form onSubmit={formik.handleSubmit}>
                <DialogContent>
                    {(!accountInfo || hasWebMasterPermission) ? <FormControl>
                        <FormLabel>角色身份</FormLabel>
                        <RadioGroup
                            row
                            name="role"
                            value={formik.values.role}
                            onChange={(e) => {
                                formik.setFieldValue("role", Number(e.target.value)); // 转换回数字
                            }}
                            onBlur={formik.handleBlur}
                        >
                            {Object.keys(CloudServiceUserRoleNameMap).map((key) => {
                                if (!hasWebMasterPermission && key >= cloudServiceAccount?.role) return null;
                                console.log(key)
                                return <FormControlLabel
                                    key={key}
                                    value={key}
                                    control={<Radio value={key}/>}
                                    label={CloudServiceUserRoleNameMap[key]}
                                />
                            })}
                        </RadioGroup>
                    </FormControl> : null}
                    <TextField
                        autoFocus
                        required
                        margin="dense"
                        name="user_name"
                        value={formik.values.user_name}
                        label="用户名"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.user_name && Boolean(formik.errors.user_name)}
                        helperText={formik.touched.user_name && formik.errors.user_name}
                        fullWidth
                        variant="standard"
                    />
                    <TextField
                        required
                        margin="dense"
                        name="email"
                        value={formik.values.email}
                        label="邮箱"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.email && Boolean(formik.errors.email)}
                        helperText={formik.touched.email && formik.errors.email}
                        fullWidth
                        variant="standard"
                    />
                    <TextField
                        margin="dense"
                        name="password"
                        type="password"
                        required={!accountInfo}
                        value={formik.values.password}
                        label={accountInfo ? '修改密码' : '设置密码'}
                        placeholder={accountInfo? '留空则不修改' : '请输入新密码'}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.password && Boolean(formik.errors.password)}
                        helperText={formik.touched.password && formik.errors.password}
                        fullWidth
                        variant="standard"
                    />
                    {accountInfo ? <FormControlLabel
                        control={<Checkbox
                            value={formik.values.reset_password_lock}
                            onChange={(e) => formik.setFieldValue('reset_password_lock', e.target.checked)}
                        />}
                        label="重置登录密码错误计数"
                    /> : null}
            </DialogContent>
            <DialogActions>
                    <Button type="button" onClick={handleCloseAccount}>取消</Button>
                    <Button type="submit">确定</Button>
                </DialogActions>
            </form>
        </Dialog>
    </Box>
}

export default AccountListPage;