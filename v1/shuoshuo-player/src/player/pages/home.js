import React, {useEffect, useState, useCallback, useMemo} from 'react';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import {
    Tooltip, IconButton, Grid, List, Typography, Box,
    Dialog, DialogTitle, ListItem, ListItemButton, ListItemText, ListItemIcon, Badge
} from '@mui/material';
import VideoAlbumCarousel from "@player/components/carousel";
import VideoItem from "@player/components/video_item";
import {MasterUpInfo} from "@/constants";
import {TimeStampNow} from "@/utils";
import RefreshIcon from '@mui/icons-material/Refresh';
import {BilibiliUserInfoSlice, BilibiliUserVideoListSlice} from "@/store/bilibili";
import {MasterVideoListSelector} from "@/store/selectors/bilibili";
import UpdateIcon from "@mui/icons-material/Update";

const HomePage = () => {
    const dispatch = useDispatch();
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const isUpdating = useSelector(BilibiliUserVideoListSlice.selectors.loadingStatus);
    const masterVideoListAll = useSelector(MasterVideoListSelector);
    const masterVideoListInfos = useSelector(BilibiliUserVideoListSlice.selectors.videoListInfo);
    const masterVideoList = useMemo(() => masterVideoListAll[MasterUpInfo.mid] ?? [], [masterVideoListAll]);
    const masterVideoListInfo = useMemo(() => masterVideoListInfos[MasterUpInfo.mid] ?? {}, [masterVideoListInfos]);
    const isLogin = useSelector(BilibiliUserInfoSlice.selectors.isLogin);

    const masterLastUpdateTime = masterVideoListInfo?.update_time ?? 0;
    const masterUpdateType = masterVideoListInfo?.update_type ?? 0;

    // 更新视频数据
    const updateMasterVideoList = useCallback((mode = 'default') => {
        setUpdateDialogOpen(false);
        if (isUpdating) return;
        dispatch(BilibiliUserVideoListSlice.actions.readUserVideos({
            mid: MasterUpInfo.mid,
            query: {
                order: 'pubdate',
                platform: 'web',
            },
            mode
        }))
        dispatch(BilibiliUserVideoListSlice.actions.readUserSpaceInfo({
            mid: MasterUpInfo.mid,
        }))
    }, [dispatch, isUpdating])

    useEffect(() => {
        if (!isLogin) return;
        const isOutdated = (masterLastUpdateTime + 86400) < TimeStampNow(); 
        if (!masterLastUpdateTime || isOutdated) {
            // 如果更新时间超过一天，则重新获取视频数据
            // 如果列表为空，则全量更新
            updateMasterVideoList(masterVideoList.length === 0 ? 'fully' : 'default');
        }
    }, [updateMasterVideoList, masterLastUpdateTime, masterVideoList, isLogin]);

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
    }, [masterVideoList]);

    return <Grid container className="player-home-page">
        <Grid item xs={12} lg={6} xl={7} className="player-home-page-left">
            <Box className="video-album-carousel-limit-container">
                <VideoAlbumCarousel slides={slidesList} />
            </Box>
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
                    更新时间：{dayjs(masterLastUpdateTime * 1000).fromNow()} {masterUpdateType === 'fully' ? '(全量)' : '(前30条)'}
                </Typography>
                <Dialog onClose={() => setUpdateDialogOpen(false)} open={updateDialogOpen}>
                    <DialogTitle>请选择更新方式</DialogTitle>
                    <List sx={{ pt: 0 }}>
                        <ListItem disableGutters>
                            <ListItemButton onClick={() => updateMasterVideoList()}>
                                <ListItemIcon>
                                    <UpdateIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>获取前30条</ListItemText>
                            </ListItemButton>
                        </ListItem>
                        <ListItem disableGutters>
                            <ListItemButton onClick={() => updateMasterVideoList('fully')}>
                                <ListItemIcon>
                                    <Badge badgeContent="全" color="primary"><UpdateIcon fontSize="small" /></Badge>
                                </ListItemIcon>
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
                            favId="main"
                        />
                    })}
                </List>
            </section>
        </Grid>
    </Grid>;
}
export default HomePage;