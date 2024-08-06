import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import '@styles/player/index.scss';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

const PlayerIndex = (props) => {
    return <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <main className="player-layout-main">This app is using the dark mode</main>
    </ThemeProvider>
}

export default PlayerIndex;