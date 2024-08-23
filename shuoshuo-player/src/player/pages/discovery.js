import React from 'react';
import {Avatar, Box, Paper, IconButton, InputBase, Typography, Stack, Button} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import {SlicerHuman} from "@/constants";

const DiscoveryPage = () => {
    const [mode, setMode] = React.useState('index');
    return <Box className={`player-discovery-main ${mode === 'search' ? 'mode-search' : ''}`}>
        <Box className="discovery-search-bar">
            <Paper
                className="discovery-search-box"
                sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400 }}
            >
                <InputBase
                    sx={{ ml: 1, flex: 1 }}
                    placeholder="请输入视频关键字"
                    inputProps={{ 'aria-label': '请输入视频关键字' }}
                />
                <IconButton type="button" sx={{ p: '10px' }} aria-label="search">
                    <SearchIcon />
                </IconButton>
            </Paper>
        </Box>
        <Box className="discovery-slicer-human">
            <Box className="slicer-box-title"><Typography  variant="h6">切片Man</Typography></Box>
            <Box className="discovery-slicer-human-container">
                {SlicerHuman.map((item) => {
                    return <Box className="slicer-card" key={item.mid}>
                        <Avatar className="slicer-avatar" sx={{ width: 64, height: 64 }} src={item.face} />
                        <Box className="slicer-meta">
                            <Typography className="slicer-name" variant="h7">{item.name}</Typography>
                            <Stack direction="row" spacing={2}>
                                <Button>添加歌单</Button>
                                <Button onClick={() => window.open(`https://space.bilibili.com/${item.mid}`)}>去TA空间</Button>
                            </Stack>
                        </Box>
                    </Box>;
                })}
            </Box>
        </Box>
        <Box className="discovery-search-list">

        </Box>
    </Box>;
}

export default DiscoveryPage;