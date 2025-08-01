import React, { useMemo, useRef, useState, useEffect, useCallback} from 'react';
import { useParams } from "react-router";
import dayjs from 'dayjs';
import Fuse from 'fuse.js';
import {
    Box, Button, IconButton, InputBase, Paper, Grid, Typography, Alert, AlertTitle,
    DialogTitle, DialogContent, DialogContentText, DialogActions, Dialog
} from "@mui/material";
import VideoItem from "@player/components/video_item";
import {useDispatch, useSelector} from "react-redux";
import {FavFoldersVideoListSelector, MasterVideoListSelector} from "@/store/selectors/bilibili";
import {FavListType, MasterUpInfo, NoticeTypes} from "@/constants";
import { FavListSlice} from "@/store/play_list";
import FavBannerCard from '../components/fav_card';
import {BilibiliUserInfoSlice, BilibiliUserVideoListSlice, BilibiliVideoEntitiesSlice} from "@/store/bilibili";
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import {PlayerNoticesSlice} from "@/store/ui";
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

export const FavListPage = (props) => {
    const params = useParams();

    const dispatch = useDispatch();
    const favBannerRef = useRef();
    const [searchKey, setSearchKey] = useState('');
    const [loadDataTip, setLoadDataTip] = useState(false);

    let favId =  params?.id ?? 'main';

    useEffect(() => {
        setSearchKey('');
    }, [favId]);

    const biliVideoListAll = useSelector(MasterVideoListSelector);
    const biliFavFolderListInfos = useSelector(FavFoldersVideoListSelector);
    const biliUpVideoListInfos = useSelector(BilibiliUserVideoListSlice.selectors.videoListInfo);
    const biliFavFolderInfos = useSelector(BilibiliUserVideoListSlice.selectors.favFoldersListInfo);
    const biliVideoEntities = useSelector(BilibiliVideoEntitiesSlice.selectors.videos);
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
    }, [favId, favList]);
    const isLogin = useSelector(BilibiliUserInfoSlice.selectors.isLogin);
    const isTypeUploader = favListInfo?.type === FavListType.UPLOADER;
    const isTypeCustom = favListInfo?.type === FavListType.CUSTOM;
    const isTypeBiliFav = favListInfo.type === FavListType.BILI_FAV;

    const favVideoList = useMemo(() => {
        if (!favListInfo) return [];
        if (favId === 'main') {
            return biliVideoListAll[MasterUpInfo.mid] ?? []
        } else if (favListInfo?.type === FavListType.UPLOADER) {
            return biliVideoListAll[favListInfo?.mid] ?? []
        } else if (favListInfo?.type === FavListType.BILI_FAV) {
            return biliFavFolderListInfos[favListInfo.biliFavFolderId] ?? [];
        }
        return favListInfo.bv_ids.map((bvId) => biliVideoEntities[bvId]).filter(item => !!item);
    }, [favId, biliVideoListAll, favListInfo, biliVideoEntities, biliFavFolderListInfos]);

    useEffect(() => {
        if (!isLogin) return;
        if ((isTypeUploader || isTypeBiliFav) && !favVideoList.length) {
            setLoadDataTip(true);
        }
    }, [isTypeUploader, isTypeBiliFav, favVideoList, setLoadDataTip, isLogin]);

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
    const biliFavFolderInfo = useMemo(() => biliFavFolderInfos[favListInfo.biliFavFolderId] ?? null, [favListInfo, biliFavFolderInfos])

    const updateTime = useMemo(() => {
        if (isTypeUploader) {
            return biliUpVideoListInfo?.update_time * 1000;
        } else if (isTypeBiliFav) {
            return biliFavFolderInfo?.update_time * 1000;
        }
        return favListInfo?.update_time || 0;
    }, [favListInfo, isTypeUploader, isTypeBiliFav, biliUpVideoListInfo, biliFavFolderInfo])

    const [delDg, setDelDg] = useState(false);
    const [delId, setDelId] = useState('');
    const handleRemoveSong = (item) => {
        setDelDg(true);
        setDelId(item.bvid)
    };
    const closeDelDg = () => {
        setDelDg(false);
    };
    const confirmRemoveSong = useCallback(() => {
        setDelDg(false);
        dispatch(FavListSlice.actions.removeFavVideo({
            favId,
            bvId: delId,
        }));
        dispatch(PlayerNoticesSlice.actions.sendNotice({
            type: NoticeTypes.SUCCESS,
            message: '移除成功',
            duration: 3000,
        }));
    }, [dispatch, favId, delId]);

    const renderListItem = ({ index, style }) => {
        const video = favVideoListSearched[index];
        return <VideoItem
            style={style}
            fullCreateTime
            key={video.bvid}
            favId={favId}
            video={video}
            showAuthor={isTypeCustom}
            removeBtn={isTypeCustom}
            onRemove={handleRemoveSong}
        />
    }

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
            {favVideoListSearched.length > 0 ? <Box sx={{ width: '100%', height: '100%' }}>
                <AutoSizer>
                    {({height, width}) => {
                        return <FixedSizeList
                            height={height}
                            width={width}
                            itemSize={108}
                            itemCount={favVideoListSearched.length}
                            overscanCount={5}
                        >
                            {renderListItem}
                        </FixedSizeList>
                    }}
                </AutoSizer>
            </Box> : (searchKey ? <Box className="fav_item_list_empty">
                <Alert severity="warning">
                    <AlertTitle>没有找到关键词为“{searchKey}”的结果</AlertTitle>
                </Alert>
            </Box> : <Box className="fav_item_list_empty">
                <Alert severity="info">
                    <AlertTitle>歌单是空的</AlertTitle>
                    {isTypeUploader || isTypeBiliFav ? <Button onClick={() => favBannerRef.current.openUpdateDialog()}>
                        点击这里同步歌曲列表
                    </Button> : <Button onClick={() => favBannerRef.current.addVideo()}>
                        点击这里添加歌曲
                    </Button>}
                </Alert>
            </Box>)}
        </Box>
        <Dialog open={delDg} onClose={closeDelDg}>
            <DialogTitle>操作提示</DialogTitle>
            <DialogContent>
                <DialogContentText>确定要移除这首音乐吗？</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeDelDg}>取消</Button>
                <Button onClick={confirmRemoveSong} color="error">确认</Button>
            </DialogActions>
        </Dialog>
        <Dialog open={loadDataTip} onClose={() => { setLoadDataTip(false)}}>
            <DialogTitle>更新数据提示</DialogTitle>
            <DialogContent>
                <DialogContentText>是否要从B站获取歌曲数据？</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { setLoadDataTip(false)}}>稍后再说</Button>
                <Button onClick={() => { setLoadDataTip(false); favBannerRef.current.updateMasterVideoList('fully');}} variant="contained" color="primary">全量加载</Button>
            </DialogActions>
        </Dialog>
    </section> : <section className="player-fav-list">
        <Typography variant="h4">歌单信息不存在</Typography>
    </section>;
}

export default FavListPage;