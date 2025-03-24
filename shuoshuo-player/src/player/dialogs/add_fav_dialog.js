import {
    Box,
    Dialog,
    DialogTitle,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography
} from "@mui/material";
import { noop } from 'lodash';
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import React, {useCallback, useMemo} from "react";
import {FavListType, NoticeTypes} from "@/constants";
import {useDispatch, useSelector} from "react-redux";
import {FavListSlice} from "@/store/play_list";
import {PlayerNoticesSlice} from "@/store/ui";

const AddFavDialog = (props) => {
    const dispatch = useDispatch();
    const {
        open = false,
        onClose = noop,
        // 传入用于排除的favId
        excludeFavId = '',
        // fromSearch 解释：如果是从搜索结果添加数据的，那么需要特别的去请求一次数据，因为搜索结果的数据是不包含视频的信息的。
        // 一般来说如果是从列表添加的，直接把bvId添加到歌单即可。
        fromSearch = false,
        video = {},
    } = props;
    const FavList = useSelector(FavListSlice.selectors.favList);

    const canAddFavList = useMemo(() => {
        return FavList.filter(favItem => favItem.type === FavListType.CUSTOM && favItem.id !== excludeFavId)
    }, [excludeFavId, FavList]);

    const confirmAddToFav = useCallback((_favId) => {
        onClose();
        if (fromSearch) {
            dispatch(FavListSlice.actions.addFavVideoByBvids({
                favId: _favId,
                bvIds: [video.bvid],
            }))
        } else {
            dispatch(FavListSlice.actions.addFavVideo({
                favId: _favId,
                bvId: video.bvid,
            }))
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.SUCCESS,
                message: '添加成功',
                duration: 3000,
            }));
        }
    }, [dispatch, fromSearch, onClose, video])

    return <Dialog onClose={onClose} open={open}>
        <DialogTitle>请选择要添加到的歌单</DialogTitle>
        {canAddFavList.length > 0 ? <List sx={{ pt: 0 }}>
            {canAddFavList.map((favItem) => {
                return <ListItem disableGutters key={favItem.id}>
                    <ListItemButton onClick={() => confirmAddToFav(favItem.id)}>
                        <ListItemIcon><QueueMusicIcon /></ListItemIcon>
                        <ListItemText>{favItem.name}</ListItemText>
                    </ListItemButton>
                </ListItem>;
            })}
        </List> : <Box sx={{margin: 2}}>
            <Typography variant="body2" color="text.secondary">暂时没有可以添加的歌单</Typography>
        </Box>}
    </Dialog>
}

export default AddFavDialog;