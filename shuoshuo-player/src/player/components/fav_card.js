import React, {forwardRef, useCallback, useImperativeHandle, useMemo, useState, useRef} from "react";
import {useDispatch, useSelector} from "react-redux";
import {BilibiliUserVideoListSlice} from "@/store/bilibili";
import dayjs from 'dayjs';
import PropTypes from "prop-types";
import {
    Dialog, DialogTitle, DialogActions, DialogContent, Button, DialogContentText,
    Box, Grid, Divider, Avatar, Menu, MenuItem, Typography, IconButton, List, ListItem, ListItemButton, ListItemText
} from "@mui/material";
import { formatNumber10K } from "@player/utils";
import MoreIcon from '@mui/icons-material/MoreVert';
import MusicIcon from '@mui/icons-material/MusicNote';
import {FavListSlice, PlayingListSlice} from "@/store/play_list";
import {useNavigate} from "react-router";
import {FavListType} from "@/constants";
import FavEditDialog from "@player/components/fav_edit";

const BilibiliUpSpaceCard = forwardRef((props, ref) => {
    const { mid, favId, favListInfo } = props;

    const [delDg, setDelDg] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const extraMenuOpen = Boolean(anchorEl);
    const favEditDgRef = useRef();

    const dispatch = useDispatch();
    const navigate = useNavigate()
    const isUpdating = useSelector(BilibiliUserVideoListSlice.selectors.loadingStatus);
    const spaceInfos = useSelector(BilibiliUserVideoListSlice.selectors.spaceInfo);

    const spaceInfo = useMemo(() => {
        if (!mid) return null;
        return spaceInfos[mid];
    }, [spaceInfos, mid])

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
        setUpdateDialogOpen(false);
        if (isUpdating) return;
        dispatch(BilibiliUserVideoListSlice.actions.readUserVideos({
            mid,
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

    // 播放歌单
    const playFavList = useCallback(() => {
        handleExtraMenuClose();
        dispatch(PlayingListSlice.actions.addFromFavList({ favId }));
    }, [dispatch, favId]);

    // 删除歌单
    const delFavList = () => {
        handleExtraMenuClose();
        setDelDg(true);
    };
    const closeDelFavListDg = () => {
        setDelDg(false);
    };
    const delFavListConfirmed = useCallback(() => {
        closeDelFavListDg();
        dispatch(FavListSlice.actions.removeFavList({ favId }));
        navigate('/index')
    }, [dispatch, navigate, favId]);


    // 编辑歌单
    const editFavList = useCallback(() => {
        favEditDgRef.current.showDialog({ id: favId })
    }, [favId])

    // 添加歌曲
    const addVideo = () => {

    }

    useImperativeHandle(ref, () => ({
        openUpdateDialog: () => setUpdateDialogOpen(true),
    }))

    const renderMenu = () => {
        const menus = [
            <MenuItem key="m1" onClick={() => playFavList()}>播放</MenuItem>,
            <MenuItem key="e1" onClick={() => editFavList()}>编辑歌单</MenuItem>
        ];
        if (favListInfo.type === FavListType.CUSTOM) {
            menus.push(<Divider key="d1"/>);
            menus.push(<MenuItem key="a1" onClick={() => addVideo()}>添加歌曲</MenuItem>);
        }
        if (mid) {
            menus.push(<Divider key="d1"/>);
            menus.push(<MenuItem key="m2" onClick={() => updateMasterVideoList()}>更新前30</MenuItem>);
            menus.push(<MenuItem key="m3" onClick={() => updateMasterVideoList('fully')}>更新整个列表</MenuItem>);
        }
        if (deleteAble) {
            menus.push(<Divider key="d2"/>)
            menus.push(<MenuItem key="m4" onClick={() => delFavList()}>删除歌单</MenuItem>)
        }
        return menus;
    }


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
                    <Typography variant="body2" color="text.primary">创建时间：{dayjs(favListInfo?.create_time).format("YYYY年MM月DD日 HH:mm") }</Typography>
                </Box>}
                <Box className="fav_list_user_card_item">
                    <IconButton onClick={openExtraMenu}>
                        <MoreIcon />
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={extraMenuOpen}
                        onClose={handleExtraMenuClose}
                        MenuListProps={{
                            'aria-labelledby': 'basic-button',
                        }}
                    >
                        {renderMenu()}
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
        <Dialog open={delDg} onClose={closeDelFavListDg}>
            <DialogTitle>重要操作提示</DialogTitle>
            <DialogContent>
                <DialogContentText>确定要删除这个歌单吗？如果是自定义歌单，添加的歌曲将不会被恢复！</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeDelFavListDg}>取消</Button>
                <Button onClick={delFavListConfirmed} color="error">确认删除</Button>
            </DialogActions>
        </Dialog>
        <Dialog onClose={() => setUpdateDialogOpen(false)} open={updateDialogOpen}>
            <DialogTitle>请选择更新方式</DialogTitle>
            <List sx={{ pt: 0 }}>
                <ListItem disableGutters>
                    <ListItemButton onClick={() => updateMasterVideoList()}>
                        <ListItemText>获取前30条</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem disableGutters>
                    <ListItemButton onClick={() => updateMasterVideoList('fully')}>
                        <ListItemText>获取完整列表</ListItemText>
                    </ListItemButton>
                </ListItem>
            </List>
        </Dialog>
        <FavEditDialog ref={favEditDgRef} />
    </Box>;
});

BilibiliUpSpaceCard.propTypes = {
    favId: PropTypes.string.isRequired,
    favListInfo: PropTypes.shape({}),
    mid: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

export default BilibiliUpSpaceCard;