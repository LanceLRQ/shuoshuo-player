import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { HashRouter } from 'react-router-dom';
import '@styles/player/index.scss';
import NavMenu from "@player/nav_menu";
import TopBar from "@player/top_bar";
import ReactJkMusicPlayer from 'react-jinke-music-player';
import 'react-jinke-music-player/assets/index.css'

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

const PlayerIndex = () => {

    const [menuOpen, setMenuOpen] = React.useState(true);
    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    const audioLists = [
        {
            name: 'Despacito',
            singer: 'Luis Fonsi',
            cover:
                'http://res.cloudinary.com/alick/image/upload/v1502689731/Despacito_uvolhp.jpg',
            musicSrc:
                'http://res.cloudinary.com/alick/video/upload/v1502689683/Luis_Fonsi_-_Despacito_ft._Daddy_Yankee_uyvqw9.mp3',
            // support async fetch music src. eg.
            // musicSrc: async () => {
            //   return await fetch('/api')
            // },
        },
    ];

    return <HashRouter>
        <ThemeProvider theme={darkTheme}>
            <CssBaseline/>
            <Box className="player-layout-main">
                <Box className="player-layout-content">
                    <TopBar menuOpen={menuOpen} toggleMenu={toggleMenu} />
                    <NavMenu menuOpen={menuOpen} toggleMenu={toggleMenu} />
                    <section className="player-layout-information">
                        tests
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
    </HashRouter>
}

export default PlayerIndex;