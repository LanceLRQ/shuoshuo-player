import React from 'react';
import { Grid } from '@mui/material';
import VideoAlbumCarousel from "@player/components/carousel";

const HomePage = () => {
    return <Grid container spacing={2}>
        <Grid item xs={12} md={6} xl={8}>
            <VideoAlbumCarousel />
        </Grid>
        <Grid item xs={12} md={6} xl={4}>

        </Grid>
    </Grid>
}
export default HomePage;