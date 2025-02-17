import React from 'react';
import { styled } from '@mui/material/styles';
import { 
    AppBar as MuiAppBar, Toolbar, IconButton, Typography, 
    Avatar, Tooltip, Menu, MenuItem, ListItemIcon, Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useSelector } from 'react-redux';
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import {MasterUpInfo} from "@/constants";
import LogoutIcon from '@mui/icons-material/Logout';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import dayjs from 'dayjs';
import isElectron from 'is-electron';

const drawerWidth = 240;

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
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
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser);
    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        // 处理退出登录逻辑
        handleMenuClose();
        window.ElectronAPI.Bilibili.Logout();
    };

    const handleImport = () => {
        // 处理导入逻辑
        const inElectron = isElectron();
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
        } else {
            alert('暂不支持在浏览器中导入数据');
        }
        handleMenuClose();
    };
    const handleExport = () => {
        // 处理导出逻辑
        const inElectron = isElectron();
        if (inElectron) {
            window.ElectronAPI.Store.Get('player_data').then((result) => {
                const data = JSON.stringify(result);
                const a = document.createElement('a');
                a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(data);
                a.download = `导出数据_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.json`;
                a.click();
            });
        } else {
            alert('暂不支持在浏览器中导出数据');
        }
        handleMenuClose();
    };

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
                {MasterUpInfo.uname}播放器
            </Typography>
            {biliUser ? <>
                <Tooltip title={biliUser.uname}>
                    <IconButton onClick={handleMenuClick}>
                        <Avatar alt={biliUser.uname} src={biliUser.face} />
                    </IconButton>
                </Tooltip>
                <Menu
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleMenuClose}
                >
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