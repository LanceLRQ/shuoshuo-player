import React, {useCallback, useMemo, useState} from "react";
import {useDispatch, useSelector} from "react-redux";
import {BilibiliUserVideoListSlice} from "@/store/bilibili";
import PropTypes from "prop-types";
import {Box, Grid, Divider, Avatar,  Menu, MenuItem, Typography, IconButton} from "@mui/material";
import { formatNumber10K } from "@player/utils";
import MoreIcon from '@mui/icons-material/MoreVert';
import MusicIcon from '@mui/icons-material/MusicNote';
import {MasterUpInfo} from "@/constants";

const BilibiliUpSpaceCard = (props) => {
    const dispatch = useDispatch();
    const { mid, favId, favListInfo } = props;
    const isUpdating = useSelector(BilibiliUserVideoListSlice.selectors.loadingStatus);
    const spaceInfos = useSelector(BilibiliUserVideoListSlice.selectors.spaceInfo);
    const spaceInfo = useMemo(() => {
        if (!mid) return null;
        return spaceInfos[mid];
    }, [spaceInfos, mid])

    const [anchorEl, setAnchorEl] = useState(null);
    const extraMenuOpen = Boolean(anchorEl);
    const handleExtraMenuClose = () => {
        setAnchorEl(null);
    }
    const openExtraMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const deleteAble = favId !== 'main';

    // 更新视频数据
    const updateMasterVideoList = useCallback((mode = 'default') => {
        handleExtraMenuClose();
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
            mid,
        }))
    }, [mid, dispatch, isUpdating])

    return <Box className="fav_list_banner_bg" sx={{ background: spaceInfo ? `url(${spaceInfo.top_photo})` : '#91d5ff'}}>
        <Box className="fav_list_banner">
            <Box className="fav_list_user_card">
                <Box className="fav_list_user_card_item">
                    {spaceInfo ? <Avatar src={spaceInfo.face} sx={{width: 80, height: 80}}></Avatar> :
                    <Avatar sx={{width: 80, height: 80}}><MusicIcon sx={{width: 64, height: 64}} /></Avatar>}
                </Box>
                {spaceInfo ? <Box className="fav_list_user_card_item content">
                    <Typography variant="h5" color="text.primary">{spaceInfo.name}</Typography>
                    <Typography variant="body2" color="text.primary">{spaceInfo.sign}</Typography>
                </Box> :
                <Box className="fav_list_user_card_item content">
                    <Typography variant="h5" color="text.primary">{favListInfo?.name}</Typography>
                    <Typography variant="body2" color="text.primary">创建时间：{favListInfo?.create_time}</Typography>
                </Box>}
                <Box className="fav_list_user_card_item">
                    <IconButton onClick={openExtraMenu}>
                        <MoreIcon />
                    </IconButton>
                    <Menu
                        id="basic-menu"
                        anchorEl={anchorEl}
                        open={extraMenuOpen}
                        onClose={handleExtraMenuClose}
                        MenuListProps={{
                            'aria-labelledby': 'basic-button',
                        }}
                    >
                        <MenuItem onClick={handleExtraMenuClose}>播放歌单</MenuItem>
                        {mid ? <>
                            <Divider />
                            <MenuItem onClick={() => updateMasterVideoList()}>更新前30</MenuItem>
                            <MenuItem onClick={() => updateMasterVideoList('fully')}>更新整个列表</MenuItem>
                        </> : null}
                        {deleteAble && <>
                            <Divider />
                            <MenuItem onClick={handleExtraMenuClose}>删除歌单</MenuItem>
                        </>}
                    </Menu>
                </Box>
            </Box>
            {spaceInfo ? <Grid container spacing={2} className="fav_list_stat_card">
                <Grid item xs={3} md="auto">
                    <Typography variant="body2" component="strong" color="text.primary">关注</Typography>
                    <Typography variant="body2" color="text.secondary">{formatNumber10K(spaceInfo.stats?.following)}</Typography>
                </Grid>
                <Grid item xs={3} md="auto">
                    <Typography variant="body2" component="strong" color="text.primary">粉丝</Typography>
                    <Typography variant="body2" color="text.secondary">{formatNumber10K(spaceInfo.stats?.follower)}</Typography>
                </Grid>
                <Grid item xs={3} md="auto">
                    <Typography variant="body2" component="strong" color="text.primary">点赞</Typography>
                    <Typography variant="body2" color="text.secondary">{formatNumber10K(spaceInfo.stats?.likes)}</Typography>
                </Grid>
                <Grid item xs={3} md="auto">
                    <Typography variant="body2" component="strong" color="text.primary">播放</Typography>
                    <Typography variant="body2" color="text.secondary">{formatNumber10K(spaceInfo.stats?.view)}</Typography>
                </Grid>
            </Grid> : null}
        </Box>
    </Box>;
}

BilibiliUpSpaceCard.propTypes = {
    favId: PropTypes.string.isRequired,
    favListInfo: PropTypes.shape({}),
    mid: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

export default BilibiliUpSpaceCard;