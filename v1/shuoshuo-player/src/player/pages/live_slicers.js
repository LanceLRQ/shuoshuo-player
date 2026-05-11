import React, {useEffect, useRef, useState} from 'react';
import {Avatar, Box, Button, Stack, Typography} from "@mui/material";
import {NoticeTypes} from "@/constants";
import FavEditDialog from "@player/dialogs/fav_edit";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {useDispatch} from "react-redux";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';

const LiveSlicersPage = () => {
    const dispatch = useDispatch();
    const favEditDgRef = useRef();
    const [liveSlicerMenList, setLiveSlicerMenList] = useState([]);
    const handleAddSlicerToFav = (item) => () => {
         favEditDgRef.current.showDialog({
             mid: item.mid,
             name: item.name
         });
    };

    useEffect(() => {
        API.CloudService.LiveSlicerMen.getLiveSlicerMenList({
            params: {
                limit: 9999999,
            }
        }).then(res => {
            setLiveSlicerMenList(res?.list ?? []);
        }).catch((err) => {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: err?.message,
                duration: 3000,
            }));
        })
    }, [dispatch]);

    return <>
        <Box className="live-slicer-human">
            <Box className="slicer-box-title"><Typography  variant="h6">说宝的切片Man</Typography></Box>
            <Box className="live-slicer-human-container">
                {liveSlicerMenList.map((item) => {
                    return <Box className="slicer-card" key={item.mid}>
                        <Avatar className="slicer-avatar" sx={{ width: 64, height: 64 }} src={item.face} />
                        <Box className="slicer-meta">
                            <Typography className="slicer-name" variant="h7">{item.name}</Typography>
                            <Stack direction="row" spacing={2}>
                                <Button onClick={handleAddSlicerToFav(item)}>
                                    <AddIcon fontSize="small" /> 添加歌单
                                </Button>
                                <Button onClick={() => window.open(`https://space.bilibili.com/${item.mid}`)}>
                                    <OpenInNewIcon fontSize="small"  /> 去TA空间
                                </Button>
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