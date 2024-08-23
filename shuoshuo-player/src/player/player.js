import React, { useEffect, useMemo } from 'react';
import {useDispatch, useSelector} from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {Box, Button, Typography} from '@mui/material';
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


const PlayerIndex = () => {
    const dispatch = useDispatch();

    const inited = useSelector(BilibiliUserInfoSlice.selectors.isInited);
    const isLogin = useSelector(BilibiliUserInfoSlice.selectors.isLogin);
    const theme = useSelector(PlayerProfileSlice.selectors.theme);

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
        <Typography variant="body">为了获得更好的体验，请先前往B站登录自己的账号</Typography>
        <Box sx={{marginTop: 4}}>
            <Button variant="contained" onClick={() => window.open('https://www.bilibili.com/')}>去B站</Button>
        </Box>
    </Box>) : <Box sx={{ textAlign: 'center'}}>
        <img alt="loading" src={LoadingGif} width={64} height={64} />
        <Typography variant="h6">{MasterUpInfo.nickname}正在{randomLoadingTip}，请稍等...</Typography>
    </Box>
}

export default PlayerIndex;