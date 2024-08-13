import React, { useEffect } from 'react';
import {useDispatch, useSelector} from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { HashRouter, Routes, Route } from 'react-router-dom';
import '@styles/player.scss';
import NavMenu from "@player/components/nav_menu";
import TopBar from "@player/components/top_bar";
import ReactJkMusicPlayer from 'react-jinke-music-player';
import 'react-jinke-music-player/assets/index.css';
import Pages from './pages';
import {BilibiliUserInfoSlice} from "@/store/bilibili";

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

    const audioLists = [
        // {
        //     name: 'Despacito',
        //     singer: 'Luis Fonsi',
        //     cover:
        //         'http://res.cloudinary.com/alick/image/upload/v1502689731/Despacito_uvolhp.jpg',
        //     musicSrc:
        //         'http://res.cloudinary.com/alick/video/upload/v1502689683/Luis_Fonsi_-_Despacito_ft._Daddy_Yankee_uyvqw9.mp3',
        //     // support async fetch music src. eg.
        //     // musicSrc: async () => {
        //     //   return await fetch('/api')
        //     // },
        // },
    ];

    return inited ? <HashRouter>
        <ThemeProvider theme={darkTheme}>
            <CssBaseline/>
            <Box className="player-layout-main">
                <Box className="player-layout-content">
                    <TopBar menuOpen={menuOpen} toggleMenu={toggleMenu} />
                    <NavMenu menuOpen={menuOpen} toggleMenu={toggleMenu} />
                    <section className="player-layout-information">
                        <Routes>
                            <Route path="" element={<Pages.HomePage />}></Route>
                        </Routes>
                    </section>
                </Box>
            </Box>
            <ReactJkMusicPlayer
                mode="full"
                toggleMode={false}
                responsive={false}
                showMediaSession
                audioLists={audioLists}
            />
        </ThemeProvider>
    </HashRouter> : <div>loading</div>
}

export default PlayerIndex;