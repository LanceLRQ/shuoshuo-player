import React, { useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { 
    AppBar as MuiAppBar, Toolbar, IconButton, Typography,  Box,
    Avatar, Tooltip, Menu, MenuItem, ListItemIcon, Divider, Chip, Stack
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useDispatch, useSelector } from 'react-redux';
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import { exportKeys, CloudServiceUserRoleNameMap} from "@/constants";
import LogoutIcon from '@mui/icons-material/Logout';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import CloudIcon from '@mui/icons-material/Cloud';
import dayjs from 'dayjs';
import isElectron from 'is-electron';
import {PlayerProfileSlice} from "@/store/ui";
import {createJsonFileLoader, objectToDownload} from "@/utils";
import API from "@/api";
import {CloudServiceSlice} from "@/store/cloud_service";
import GitHubIcon from '@mui/icons-material/GitHub';

const drawerWidth = 240;

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
    color: "#fff",
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    "& .MuiButtonBase-root": {
        color: "#fff",
    },
    ...(open && {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const TopBar = (props) => {
    const { menuOpen, toggleMenu } = props;
    const dispatch = useDispatch();
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser);
    const isCloudServiceLogin = useSelector(CloudServiceSlice.selectors.isLogin);
    const cloudServiceUserRole = useSelector(CloudServiceSlice.selectors.roleName);
    const themeMode = useSelector(PlayerProfileSlice.selectors.theme);
    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);
    const inElectron = isElectron();

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = useCallback(() => {
        setAnchorEl(null);
    }, [setAnchorEl]);

    const handleLogout = () => {
        // 处理退出登录逻辑
        handleMenuClose();
        window.ElectronAPI.Bilibili.Logout();
    };

    const handleImport = useCallback(() => {
        // 处理导入逻辑
        if (inElectron) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const confirmImport = window.confirm('确定要导入数据吗？导入后当前数据将被覆盖');
                        if (confirmImport) {
                            try {
                                const data = JSON.parse(event.target.result);
                                window.ElectronAPI.Store.Set('player_data', data);
                                alert('导入数据成功');
                                window.location.reload();
                            } catch (error) {
                                alert('导入数据失败，请检查文件格式是否正确');
                            }
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        } else if (chrome && chrome.storage && chrome.storage.local)  {
            const chromeStorage = chrome && chrome.storage && chrome.storage.local;
            createJsonFileLoader((ret) => {
                const confirmImport = window.confirm('确定要导入数据吗？导入后当前数据将被覆盖');
                if (confirmImport) {
                    chromeStorage.set(ret, () => {
                        alert('导入成功');
                        window.location.reload();
                    })
                }
            }, (e) => {
                alert(e)
            })
        } else {
            alert('当前环境不支持导入数据');
        }
        handleMenuClose();
    }, [inElectron, handleMenuClose]);

    const handleExport = useCallback(() => {
        // 处理导出逻辑
        if (inElectron) {
            window.ElectronAPI.Store.Get('player_data').then((result) => {
                const data = JSON.stringify(result);
                const a = document.createElement('a');
                a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(data);
                a.download = `导出数据_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.json`;
                a.click();
            });
        } else if (chrome && chrome.storage && chrome.storage.local) {
            const chromeStorage = chrome && chrome.storage && chrome.storage.local;
            chromeStorage.get(exportKeys, (result) => {
                objectToDownload(result, `导出数据_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.json`);
            })
        } else {
            alert('当前环境不支持导出数据');
        }
        handleMenuClose();
    }, [inElectron, handleMenuClose]);

    const handleThemeChange = useCallback(() => {
        dispatch(PlayerProfileSlice.actions.setTheme({
            theme: themeMode === 'light' ? 'dark': 'light',
        }));
    }, [themeMode, dispatch]);

    const handleShowCloudServicePage = () => {
        handleMenuClose();
        API.CloudService.Account.checkLogin({}).then((res) => {
            if (!res.login) {
                dispatch(CloudServiceSlice.actions.clearSession())
                window.SHOW_CLOUD_LOGIN();
            } else {
                if(window.confirm(`已登录：${res?.account?.email}\n当前身份：${CloudServiceUserRoleNameMap[res?.account?.role] || '未知'}\n是否切换账号？`)){
                    dispatch(CloudServiceSlice.actions.clearSession())
                    window.SHOW_CLOUD_LOGIN();
                }
            }
        }).catch((e) => {
            alert('网络异常');
        })
    }

    return <AppBar position="absolute" open={menuOpen}>
        <Toolbar
            sx={{
                pr: '24px', // keep right padding when drawer closed
            }}
        >
            <IconButton
                edge="start"
                color="inherit"
                aria-label="open drawer"
                onClick={toggleMenu}
                sx={{
                    marginRight: '36px',
                    ...(menuOpen && { display: 'none' }),
                }}
            >
                <MenuIcon />
            </IconButton>
            <Typography
                component="h1"
                variant="h6"
                color="inherit"
                noWrap
                sx={{ flexGrow: 1 }}
            >
                说说播放器
            </Typography>
            {biliUser ? <>
                <Box>
                    <Stack spacing={2} direction="row">
                        <Tooltip title="喜欢的话点个star呗！">
                            <IconButton onClick={() => window.open('https://github.com/LanceLRQ/shuoshuo-player', '_blank')}>
                                <GitHubIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={themeMode === 'dark' ? '白天模式' : '黑夜模式'}>
                            <IconButton onClick={handleThemeChange}>
                                {themeMode === 'dark' ? <LightModeIcon />:<DarkModeIcon />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={biliUser.uname}>
                            <IconButton onClick={handleMenuClick}>
                                <Avatar sx={{ width: 24, height: 24 }} alt={biliUser.uname} src={biliUser.face} />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>
                <Menu
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleMenuClose}
                >
                    <MenuItem onClick={handleShowCloudServicePage}>
                        <ListItemIcon>
                            <CloudIcon fontSize="small" />
                        </ListItemIcon>
                        <Stack direction="row" spacing={2}>
                            <span>云服务</span>
                            {isCloudServiceLogin ? <Chip size="small" color="primary" label={cloudServiceUserRole} /> : null}
                        </Stack>
                    </MenuItem>
                    <Divider></Divider>
                    <MenuItem onClick={handleImport}>
                        <ListItemIcon>
                            <FileUploadIcon fontSize="small" />
                        </ListItemIcon>
                        导入
                    </MenuItem>
                    <MenuItem onClick={handleExport}>
                        <ListItemIcon>
                            <FileDownloadIcon fontSize="small" />
                        </ListItemIcon>
                        导出
                    </MenuItem>
                    <Divider></Divider>
                    <MenuItem onClick={handleLogout}>
                        <ListItemIcon>
                            <LogoutIcon fontSize="small" />
                        </ListItemIcon>
                        退出登录
                    </MenuItem>
                </Menu>
            </> : null}
        </Toolbar>
    </AppBar>;
};

export default TopBar;