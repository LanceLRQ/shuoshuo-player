import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { HashRouter } from 'react-router-dom';
import '@styles/player/index.scss';
import NavMenu from "@player/nav_menu";
import TopBar from "@player/top_bar";

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


    return <HashRouter>
        <ThemeProvider theme={darkTheme}>
            <CssBaseline/>

            <Box className="player-layout-main">
                <Box className="player-layout-content">
                    <TopBar menuOpen={menuOpen} toggleMenu={toggleMenu} />
                    <NavMenu menuOpen={menuOpen} toggleMenu={toggleMenu} />
                    <section className="player-layout-information">
                        {menuOpen ? 'open':'flase'}
                    </section>
                </Box>
                <section className="player-layout-bar">2</section>
            </Box>
        </ThemeProvider>
    </HashRouter>
}

export default PlayerIndex;