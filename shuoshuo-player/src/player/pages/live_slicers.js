import React, {useRef} from 'react';
import {Avatar, Box, Button, Stack, Typography} from "@mui/material";
import {SlicerHuman} from "@/constants";
import FavEditDialog from "@player/dialogs/fav_edit";

const LiveSlicersPage = () => {
    const favEditDgRef = useRef();
    const handleAddSlicerToFav = (item) => () => {
         favEditDgRef.current.showDialog({
             mid: item.mid,
             name: item.name
         });
    };
    return <>
        <Box className="live-slicer-human">
            <Box className="slicer-box-title"><Typography  variant="h6">切片Man</Typography></Box>
            <Box className="live-slicer-human-container">
                {SlicerHuman.map((item) => {
                    return <Box className="slicer-card" key={item.mid}>
                        <Avatar className="slicer-avatar" sx={{ width: 64, height: 64 }} src={item.face} />
                        <Box className="slicer-meta">
                            <Typography className="slicer-name" variant="h7">{item.name}</Typography>
                            <Stack direction="row" spacing={2}>
                                <Button onClick={handleAddSlicerToFav(item)}>添加歌单</Button>
                                <Button onClick={() => window.open(`https://space.bilibili.com/${item.mid}`)}>去TA空间</Button>
                            </Stack>
                        </Box>
                    </Box>;
                })}
            </Box>
        </Box>
        <FavEditDialog ref={favEditDgRef} />
    </>
}

export default LiveSlicersPage;