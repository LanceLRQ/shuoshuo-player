import React, { useEffect, useMemo, useRef } from 'react';
import {useDispatch, useSelector} from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {Box, Button, Typography, Stack} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Outlet } from 'react-router-dom';
import '@styles/player.scss';
import NavMenu from "@player/layout/nav_menu";
import TopBar from "@player/layout/top_bar";
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import SPlayerIndex from "@player/splayer";
import {PlayerProfileSlice} from "@/store/ui";
import LoadingGif from '@/images/loading.webp';
import {MasterUpInfo, StartupLoadingTip} from "@/constants";
import isElectron from "is-electron";
import CloudLoginDialog from "@player/dialogs/cloud_login";
import {CloudServiceSlice} from "@/store/cloud_service";

const PlayerIndex = () => {
    const dispatch = useDispatch();

    const inited = useSelector(BilibiliUserInfoSlice.selectors.isInited);
    const isLogin = useSelector(BilibiliUserInfoSlice.selectors.isLogin);
    const theme = useSelector(PlayerProfileSlice.selectors.theme);
    const cloudServiceSession = useSelector(CloudServiceSlice.selectors.sessionInfo)
    const cloudServiceIsLogin = useSelector(CloudServiceSlice.selectors.isLogin)
    const inElectron = isElectron();
    const cloudLoginDialogRef = useRef(null);

    window.SHOW_CLOUD_LOGIN = () => {
        if (!cloudLoginDialogRef.current) return;
        cloudLoginDialogRef.current.showDialog();
    }
    useEffect(() => {
        if (cloudServiceIsLogin) {
            console.info('[云服务]已登录')
            window.CLOUD_SERVICE_SESSION = cloudServiceSession;
        } else{
            window.CLOUD_SERVICE_SESSION = null;
            console.info('[云服务]未登录')
        }
    }, [cloudServiceIsLogin, cloudServiceSession])

    useEffect(() => {
        const htmlElement = document.documentElement;
        if (theme === 'dark') {
            htmlElement.classList.add(`player-theme-dark`);
            htmlElement.classList.remove('player-theme-light');
        } else {
            htmlElement.classList.add(`player-theme-light`);
            htmlElement.classList.remove('player-theme-dark');
        }
        // 清理函数，确保组件卸载时移除 class
        return () => {
            htmlElement.classList.remove('player-theme-light');
            htmlElement.classList.remove('player-theme-dark');
        };
    }, [theme]);


    useEffect(() => {
        if (inElectron) {
            window.ElectronAPI.Bilibili.LoginSuccess(() => {
                window.location.reload();
            })
        }
    }, [inElectron])

    useEffect( () => {
        dispatch(BilibiliUserInfoSlice.actions.getLoginUserInfo());
    }, [dispatch]);

    const [menuOpen, setMenuOpen] = React.useState(true);
    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    const muiTheme = createTheme({
        palette: {
            mode: theme ?? 'light',
            ...(theme === 'light' ? {
                primary: {
                    main: '#ff4d4f',
                    light: '#ff7875',
                    dark: '#cf1322'
                }
            } : {}),
        }
    });

    const randomLoadingTip = useMemo(() => {
        return StartupLoadingTip[Math.floor(Math.random() * StartupLoadingTip.length)]
    }, [])

    if (inited) {
        if (isLogin) {
            return <ThemeProvider theme={muiTheme}>
                <CssBaseline/>
                <Box className={`player-layout-main player-theme-${theme}`}>
                    <Box className="player-layout-content">
                        <TopBar menuOpen={menuOpen} toggleMenu={toggleMenu} />
                        <NavMenu menuOpen={menuOpen} toggleMenu={toggleMenu} />
                        <section className="player-layout-information">
                            <Outlet />
                        </section>
                    </Box>
                </Box>
                <SPlayerIndex />
                <CloudLoginDialog ref={cloudLoginDialogRef} />
            </ThemeProvider>;
        } else {
            return <Box className="b-login-require">
                <Typography variant="h4">请登录B站账号</Typography>
                <Typography variant="body">请先前往B站登录自己的账号，然后返回刷新页面即可正常使用</Typography>
                <Box sx={{marginTop: 4}}>
                    <Stack spacing={2} direction="row" >
                        <Button variant="contained" onClick={() => {
                            if (inElectron) {
                                window.ElectronAPI.Bilibili.Login();
                            } else {
                                window.open('https://passport.bilibili.com/pc/passport/login')
                            }
                        }}>去B站</Button>
                        <Button variant="outlined" onClick={() => window.location.reload()}>刷新</Button>
                    </Stack>
                </Box>
            </Box>
        }
    }

    return <Box sx={{ textAlign: 'center'}}>
        <img alt="loading" src={LoadingGif} width={64} height={64} />
        <Typography variant="h6">{MasterUpInfo.nickname}正在{randomLoadingTip}，请稍等...</Typography>
    </Box>
}

export default PlayerIndex;