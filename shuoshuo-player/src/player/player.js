import React, { useEffect } from 'react';
import {useDispatch, useSelector} from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Outlet } from 'react-router-dom';
import '@styles/player.scss';
import NavMenu from "@player/components/nav_menu";
import TopBar from "@player/components/top_bar";
import 'react-jinke-music-player/assets/index.css';
import {BilibiliUserInfoSlice} from "@/store/bilibili";
import CustomJkPlayer from "@player/components/jk_player";


const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

const PlayerIndex = () => {
    const dispatch = useDispatch();

    const inited = useSelector(BilibiliUserInfoSlice.selectors.isInited);
    useEffect( () => {
        dispatch(BilibiliUserInfoSlice.actions.getLoginUserInfo());
    }, [dispatch]);

    const [menuOpen, setMenuOpen] = React.useState(true);
    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    return inited ? <ThemeProvider theme={darkTheme}>
        <CssBaseline/>
        <Box className="player-layout-main">
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