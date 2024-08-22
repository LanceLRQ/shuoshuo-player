import React, {useCallback, useMemo, useRef, useState, useEffect} from 'react';
import { useParams } from "react-router";
import dayjs from 'dayjs';
import Fuse from 'fuse.js';
import {Box, Button, IconButton, InputBase, Paper, List, Grid, Typography, Alert, AlertTitle} from "@mui/material";
import VideoItem from "@player/components/video_item";
import {useDispatch, useSelector} from "react-redux";
import {MasterVideoListSelector} from "@/store/selectors/bilibili";
import {FavListType, MasterUpInfo} from "@/constants";
import {PlayingListSlice, FavListSlice} from "@/store/play_list";
import FavBannerCard from '../components/fav_card';
import {BilibiliUserVideoListSlice} from "@/store/bilibili";
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

export const FavListPage = (props) => {
    const dispatch = useDispatch();
    const params = useParams();

    const favBannerRef = useRef();
    const [searchKey, setSearchKey] = useState('');

    let favId =  params?.id ?? 'main';

    useEffect(() => {
        setSearchKey('');
    }, [favId]);

    const biliVideoListAll = useSelector(MasterVideoListSelector);
    const biliUpVideoListInfos = useSelector(BilibiliUserVideoListSlice.selectors.videoListInfo);
    const favList = useSelector(FavListSlice.selectors.favList);
    const favListInfo = useMemo(() => {
        if (favId === 'main') {
            return {
                id: 'main',
                type: FavListType.UPLOADER,
                name: `${MasterUpInfo.uname}的歌单`,
                mid: MasterUpInfo.mid,
            }
        }
        return favList.find(item => item.id === favId);
    }, [favId, favList])
    const isTypeUploader = favListInfo?.type === FavListType.UPLOADER;
    const favVideoList = useMemo(() => {
        if (favId === 'main') {
            return biliVideoListAll[MasterUpInfo.mid] ?? []
        } else if (favListInfo?.type === FavListType.UPLOADER) {
            return biliVideoListAll[favListInfo?.mid] ?? []
        }
        return [];
    }, [favId, biliVideoListAll, favListInfo]);
    const favVideoListSearched = useMemo(() => {
        if (searchKey) {
            const fuse = new Fuse(favVideoList, {
                keys: ['title'], // 指定要搜索的键
                threshold: 0.3,  // 阈值越低，匹配越精确（0.0 - 1.0）
            });
            return fuse.search(searchKey).map(item => item.item);
        }
        return favVideoList;
    }, [searchKey, favVideoList]);
    const biliMid = useMemo(() => {
        if (favId === 'main') {
            return MasterUpInfo.mid;
        }
        if (isTypeUploader) {
            return favListInfo?.mid;
        }
        return 0;
    }, [favId, favListInfo, isTypeUploader]);
    const biliUpVideoListInfo = useMemo(() => biliUpVideoListInfos[biliMid] ?? null, [biliMid, biliUpVideoListInfos]);


    const handlePlayItemClick = useCallback((video) => {
        dispatch(PlayingListSlice.actions.addSingle({
            bvId: video.bvid,
            playNow: false
        }));
    }, [dispatch])

    const updateTime = (isTypeUploader ? (biliUpVideoListInfo?.update_time * 1000) : favListInfo?.update_time) || 0

    return favListInfo ? <section className="player-fav-list" key={favId}>
        <FavBannerCard ref={favBannerRef} favId={favId} mid={biliMid} favListInfo={favListInfo} />
        {favVideoList.length > 0 ? <Grid container className="fav_status_bar">
            <Grid className="status_text" item xs={6} md={8}>
                更新时间：{dayjs(updateTime).format("YYYY年MM月DD日 HH:mm")}
            </Grid>
            <Grid item xs={6} md={4}>
                <Paper sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ p: '10px', display: 'flex' }}>
                        <SearchIcon />
                    </Box>
                    <InputBase
                        sx={{ ml: 1, flex: 1 }}
                        placeholder="搜索歌曲"
                        inputProps={{ 'aria-label': 'search google maps' }}
                        value={searchKey}
                        onChange={(e) => setSearchKey(e.target.value)}
                    />
                    {searchKey ? <IconButton type="button" sx={{ p: '10px' }} onClick={() => setSearchKey('')}>
                        <ClearIcon />
                    </IconButton> : null}
                </Paper>
            </Grid>
        </Grid> : null}
        <Box className="fav_item_list">
            {favVideoListSearched.length > 0 ? <List sx={{width: '100%', bgcolor: 'background.paper'}}>
                {favVideoListSearched.map((video) => {
                    return <VideoItem
                        fullCreateTime
                        key={video.bvid}
                        video={video}
                        playNowBtn={false}
                        onDirect={(item) => {
                            window.open('https://bilibili.com/video/' + item.bvid);
                        }}
                        onPlay={handlePlayItemClick}
                    />
                })}
            </List> : (searchKey ? <Box className="fav_item_list_empty">
                <Alert severity="warning">
                    <AlertTitle>没有找到关键词为“{searchKey}”的结果</AlertTitle>
                </Alert>
            </Box> : <Box className="fav_item_list_empty">
                <Alert severity="info">
                    <AlertTitle>歌单是空的</AlertTitle>
                    {isTypeUploader ? <Button onClick={() => favBannerRef.current.openUpdateDialog()}>
                        点击这里同步歌曲列表
                    </Button> : <Button>
                        点击这里添加歌曲
                    </Button>}
                </Alert>
            </Box>)}
        </Box>
    </section> : <section className="player-fav-list">
        <Typography variant="h4">歌单信息不存在</Typography>
    </section>;
}

export default FavListPage;