import React, { useEffect, useMemo } from 'react';
import {useDispatch, useSelector} from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {Box, Button, Typography, Stack} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Outlet } from 'react-router-dom';
import '@styles/player.scss';
import NavMenu from "@player/components/nav_menu";
import TopBar from "@player/components/top_bar";
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import CustomJkPlayer from "@player/components/jk_player";
import {PlayerProfileSlice} from "@/store/ui";
import LoadingGif from '@/images/loading.webp';
import {MasterUpInfo, StartupLoadingTip} from "@/constants";
import isElectron from "is-electron";


const PlayerIndex = () => {
    const dispatch = useDispatch();

    const inited = useSelector(BilibiliUserInfoSlice.selectors.isInited);
    const isLogin = useSelector(BilibiliUserInfoSlice.selectors.isLogin);
    const theme = useSelector(PlayerProfileSlice.selectors.theme);
    const inElectron = isElectron();

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
            mode: theme ?? 'dark',
        },
    });

    const randomLoadingTip = useMemo(() => {
        return StartupLoadingTip[Math.floor(Math.random() * StartupLoadingTip.length)]
    }, [])

    return inited ? (isLogin ? <ThemeProvider theme={muiTheme}>
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
        <CustomJkPlayer />
    </ThemeProvider> : <Box className="b-login-require">
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
    </Box>) : <Box sx={{ textAlign: 'center'}}>
        <img alt="loading" src={LoadingGif} width={64} height={64} />
        <Typography variant="h6">{MasterUpInfo.nickname}正在{randomLoadingTip}，请稍等...</Typography>
    </Box>
}

export default PlayerIndex;