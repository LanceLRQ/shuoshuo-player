import React, { useEffect } from 'react';
import {useDispatch, useSelector} from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Outlet } from 'react-router-dom';
import '@styles/player.scss';
import NavMenu from "@player/components/nav_menu";
import TopBar from "@player/components/top_bar";
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import CustomJkPlayer from "@player/components/jk_player";
import {PlayerProfileSlice} from "@/store/ui";


const PlayerIndex = () => {
    const dispatch = useDispatch();

    const inited = useSelector(BilibiliUserInfoSlice.selectors.isInited);
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

    return inited ? <ThemeProvider theme={muiTheme}>
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
    </ThemeProvider> : <div>loading</div>
}

export default PlayerIndex;