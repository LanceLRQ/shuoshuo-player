import React, {useEffect, useState, useCallback, useMemo} from 'react';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import {
    Tooltip, IconButton, Grid, List, Typography,
    Dialog, DialogTitle, ListItem, ListItemButton, ListItemText
} from '@mui/material';
import VideoAlbumCarousel from "@player/components/carousel";
import VideoItem from "@player/components/video_item";
import {readUserVideos, readUserVideosAll} from "@player/utils";
import {MasterUpInfo} from "@/constants";
import {TimeStampNow} from "@/utils";
import RefreshIcon from '@mui/icons-material/Refresh';

const HomePage = () => {
    const dispatch = useDispatch();
    const [loaded, setLoaded] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const masterLastUpdateTime = useSelector((state) => state.caches?.user_video_list?.[MasterUpInfo.mid]?.update_time ?? 0);
    const masterVideoList = useSelector((state) => state.caches?.user_video_list?.[MasterUpInfo.mid]?.video_list ?? []);

    // 前30更新
    const updateMasterVideoList = useCallback(() => {
        setUpdateDialogOpen(false);
        readUserVideos(dispatch, MasterUpInfo.mid, {
            order: 'pubdate',
            platform: 'web',
        }).then(() => {
            setLoaded(true);
        });
    }, [dispatch, setLoaded])

    // 手动触发全量更新
    const updateMasterVideoListAll = useCallback(() => {
        setUpdateDialogOpen(false);
        readUserVideosAll(dispatch, MasterUpInfo.mid, {
            order: 'pubdate',
            platform: 'web',
        }).then(() => {
            setLoaded(true);
        });
    }, [dispatch, setLoaded])

    useEffect(() => {
        const isOutdated = (masterLastUpdateTime + 86400) < TimeStampNow();   // 一小时更新一次
        if (!masterLastUpdateTime || isOutdated) {
            updateMasterVideoList();
        } else {
            setLoaded(true);
        }
    }, [updateMasterVideoList, masterLastUpdateTime]);

    const slidesList = useMemo(() => {
        const ret = [];
        masterVideoList.forEach((item, index) => {
            if (index >= 5) return;
            ret.push({
                title: item.title,
                pic: item.pic,
                onClick: () => {
                    window.open('https://bilibili.com/video/' + item.bvid);
                }
            })
        })
        return ret;
    }, [masterVideoList])

    return loaded ? <Grid container spacing={2} className="player-home-page">
        <Grid item xs={12} lg={6} xl={7} className="player-home-page-left">
            <VideoAlbumCarousel slides={slidesList} />
        </Grid>
        <Grid item xs={12} lg={6} xl={5} className="player-home-page-right">
            <section className="player-home-page-recent-title">
                <Typography variant="h6" color="text.primary">
                    最新投稿
                    <Tooltip title="立即更新" placement="top">
                        <IconButton size="small" onClick={() => setUpdateDialogOpen(true)}><RefreshIcon/></IconButton>
                    </Tooltip>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    更新时间：{dayjs(masterLastUpdateTime * 1000).fromNow()}
                </Typography>
                <Dialog onClose={() => setUpdateDialogOpen(false)} open={updateDialogOpen}>
                    <DialogTitle>请选择更新方式</DialogTitle>
                    <List sx={{ pt: 0 }}>
                        <ListItem disableGutters>
                            <ListItemButton onClick={() => updateMasterVideoList()}>
                                <ListItemText>获取前30条</ListItemText>
                            </ListItemButton>
                        </ListItem>
                        <ListItem disableGutters>
                            <ListItemButton onClick={() => updateMasterVideoListAll()}>
                                <ListItemText>获取完整列表</ListItemText>
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Dialog>
            </section>
            <section className="player-home-page-recent-list">
                <List sx={{width: '100%', bgcolor: 'background.paper'}}>
                    {masterVideoList.map((video, index) => {
                        if (!video || index > 30) return null;
                        return <VideoItem
                            key={video.bvid}
                            video={video}
                            onDirect={(item) => {
                                window.open('https://bilibili.com/video/' + item.bvid);
                            }}
                        />
                    })}
                </List>
            </section>
        </Grid>
    </Grid>
: null;
}
export default HomePage;