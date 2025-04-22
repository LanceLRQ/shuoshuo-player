import React, {forwardRef, useCallback, useImperativeHandle, useMemo, useState, useRef} from "react";
import {useDispatch, useSelector} from "react-redux";
import {BilibiliUserVideoListSlice} from "@/store/bilibili";
import dayjs from 'dayjs';
import PropTypes from "prop-types";
import {
    Dialog, DialogTitle, DialogActions, DialogContent, Button, DialogContentText, ListItemIcon, Badge,
    Box, Grid, Divider, Avatar, Menu, MenuItem, Typography, IconButton, List, ListItem, ListItemButton, ListItemText
} from "@mui/material";
import { formatNumber10K } from "@player/utils";
import MoreIcon from '@mui/icons-material/MoreVert';
import MusicIcon from '@mui/icons-material/MusicNote';
import {FavListSlice, PlayingListSlice} from "@/store/play_list";
import {useNavigate} from "react-router";
import {FavListType, NoticeTypes} from "@/constants";
import FavEditDialog from "@player/dialogs/fav_edit";
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import AddIcon from '@mui/icons-material/Add';
import UpdateIcon from '@mui/icons-material/Update';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddSongDialog from "@player/dialogs/fav_add_song";
import {PlayerNoticesSlice} from "@/store/ui";

const BilibiliUpSpaceCard = forwardRef((props, ref) => {
    const { mid, favId, favListInfo } = props;

    const [delDg, setDelDg] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const extraMenuOpen = Boolean(anchorEl);
    const favEditDgRef = useRef();
    const addSongDgRef = useRef();

    const dispatch = useDispatch();
    const navigate = useNavigate()
    const isUpdating = useSelector(BilibiliUserVideoListSlice.selectors.loadingStatus);
    const spaceInfos = useSelector(BilibiliUserVideoListSlice.selectors.spaceInfo);
    const biliFavFolderInfos = useSelector(BilibiliUserVideoListSlice.selectors.favFoldersListInfo);

    const biliFavFolderInfo = useMemo(() => biliFavFolderInfos[favListInfo.biliFavFolderId] ?? null, [favListInfo, biliFavFolderInfos])

    const isTypeCustom = favListInfo.type === FavListType.CUSTOM;
    const isTypeUploader = favListInfo.type === FavListType.UPLOADER;
    const isTypeBiliFav = favListInfo.type === FavListType.BILI_FAV;

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
        if (isTypeUploader) {
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
        } else if (isTypeBiliFav) {
            dispatch(BilibiliUserVideoListSlice.actions.readUserFavFolderVideos({
                query: {
                    media_id: favListInfo.biliFavFolderId
                },
                mode
            }))
        }
    }, [mid, dispatch, isUpdating, isTypeUploader, isTypeBiliFav, favListInfo])

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
        dispatch(PlayerNoticesSlice.actions.sendNotice({
            type: NoticeTypes.SUCCESS,
            message: '删除成功',
            duration: 3000,
        }));
        navigate('/index')
    }, [dispatch, navigate, favId]);


    // 编辑歌单
    const editFavList = useCallback(() => {
        handleExtraMenuClose();
        favEditDgRef.current.showDialog({ id: favId })
    }, [favId])

    // 添加歌曲
    const addVideo = () => {
        handleExtraMenuClose();
        addSongDgRef.current.showDialog();
    }

    useImperativeHandle(ref, () => ({
        openUpdateDialog: () => setUpdateDialogOpen(true),
        addVideo: () => addVideo(),
    }))

    const renderMenu = () => {

        const menus = [
            { title: '播放歌单', onClick: () => playFavList(), icon: <PlaylistPlayIcon fontSize="small" />, visible: true },
            { type: 'divider', visible: isTypeCustom },
            { title: '添加歌曲', onClick: () => addVideo(), icon: <AddIcon fontSize="small" />, visible: isTypeCustom },
            { type: 'divider',  visible: !!mid },
            { title: '更新前30', onClick: () => updateMasterVideoList(), icon: <UpdateIcon fontSize="small" />, visible: isTypeUploader || isTypeBiliFav },
            { title: '更新整个列表', onClick: () => updateMasterVideoList('fully'),
                icon: <Badge badgeContent="全" color="primary"><UpdateIcon fontSize="small" /></Badge>, visible: isTypeUploader || isTypeBiliFav
            },
            { type: 'divider', visible: true },
            { title: '编辑歌单', onClick: () => editFavList(), icon: <EditIcon fontSize="small" />, visible: true },
            { title: '删除歌单', onClick: () => delFavList(), icon: <DeleteIcon fontSize="small" />, visible: deleteAble },
        ];

        return menus.map((item, index) => {
            if (!item.visible) return null;
            if (item.type === 'divider') return <Divider key={`d${index}`}/>;
            return <MenuItem key={`m${index}`} onClick={item.onClick}>
                {item.icon ? <ListItemIcon>{item.icon}</ListItemIcon> : null}
                <ListItemText>{item.title}</ListItemText>
            </MenuItem>
        });
    }

    const renderAvatar = () => {
        if (spaceInfo) {
            return <Avatar src={spaceInfo?.face} sx={{width: 80, height: 80}}></Avatar>
        } else if (biliFavFolderInfo) {
            return <Avatar src={biliFavFolderInfo?.info?.cover} sx={{width: 80, height: 80}}></Avatar>
        }
        return <Avatar sx={{width: 80, height: 80}}><MusicIcon sx={{width: 64, height: 64}} /></Avatar>;
    }

    return <Box className="fav_list_banner_bg" sx={{ background: spaceInfo ? `url(${spaceInfo.top_photo})` : '#91d5ff'}}>
        <Box className="fav_list_banner">
            <Box className="fav_list_user_card">
                <Box className="fav_list_user_card_item">
                    {renderAvatar()}
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
        <AddSongDialog favId={favId} ref={addSongDgRef} />
    </Box>;
});

BilibiliUpSpaceCard.propTypes = {
    favId: PropTypes.string.isRequired,
    favListInfo: PropTypes.shape({}),
    mid: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

export default BilibiliUpSpaceCard;