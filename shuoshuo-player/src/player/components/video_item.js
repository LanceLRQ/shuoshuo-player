import React, {useCallback, useState} from 'react';
import PropTypes from 'prop-types';
import dayjs from "dayjs";
import {
    Chip, ListItem, ListItemAvatar, ListItemText, IconButton,
    Stack, Tooltip, Menu, Divider, MenuItem, ListItemIcon
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayCircleIcon from '@mui/icons-material/PlayCircleOutline';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import ChatIcon from '@mui/icons-material/Chat';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import AddIcon from '@mui/icons-material/Add';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatNumber10K, urlPrefixFixed } from "@player/utils";
import MoreIcon from "@mui/icons-material/MoreVert";
import { PlayingListSlice } from "@/store/play_list";
import {useDispatch, useSelector} from "react-redux";
import { NoticeTypes} from "@/constants";
import {PlayerNoticesSlice} from "@/store/ui";
import AddFavDialog from "@player/components/add_fav_dialog";


const VideoItem = (props) => {
    const {
        video, favId, fullCreateTime, showAuthor, style,
        htmlTitle = false, fromSearch = false
    } = props;
    const dispatch = useDispatch();

    const [anchorEl, setAnchorEl] = useState(null);
    const [favListDialogOpen, setFavListDialogOpen] = useState(false);
    const currentBvID = useSelector(PlayingListSlice.selectors.currentBvID);
    const extraMenuOpen = Boolean(anchorEl);
    const handleExtraMenuClose = () => {
        setAnchorEl(null);
    }
    const openExtraMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handlePlayClick = useCallback(() => {
        if (favId) {
            dispatch(PlayingListSlice.actions.addFromFavList({
                favId: favId,
                bvId: video.bvid,
                playNow: true,
            }));
            return;
        }
        dispatch(PlayingListSlice.actions.addSingle({
            bvId: video.bvid,
            playNow: true,
        }));
    }, [dispatch, video, favId])

    const handleAddToFavClick = () => {
        setFavListDialogOpen(true);
        handleExtraMenuClose();
    };

    const handleAddToPlayClick = useCallback(() => {
        handleExtraMenuClose();
        dispatch(PlayingListSlice.actions.addSingle({
            bvId: video.bvid,
            playNow: false,
        }))
        dispatch(PlayerNoticesSlice.actions.sendNotice({
            type: NoticeTypes.SUCCESS,
            message: '添加成功',
            duration: 3000,
        }));
    }, [dispatch, video]);



    const { addBtn = true, addToPlayBtn = true, removeBtn = false } = props;
    const renderMenu = () => {
        const menus = [
            {
                title: '稍后播放',
                onClick: () => handleAddToPlayClick(),
                icon: <ScheduleIcon fontSize="small" />,
                visible: addBtn
            },
            {
                title: '添加到歌单',
                onClick: () => handleAddToFavClick(),
                icon: <AddIcon fontSize="small" />,
                visible: addToPlayBtn
            },
            { type: 'divider', visible: addBtn || addToPlayBtn },
            {
                title: '去B站看',
                onClick: () => {
                    handleExtraMenuClose();
                    window.open('https://bilibili.com/video/' + video.bvid);
                },
                icon: <OpenInNewIcon fontSize="small" />,
                visible: true
            },
            { type: 'divider', visible: removeBtn },
            {
                title: '移除歌曲',
                onClick: () => {
                    handleExtraMenuClose();
                    if (props.onRemove) props.onRemove(video);
                },
                icon: <DeleteIcon fontSize="small" />,
                visible: removeBtn
            },
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


    const isPlaying = currentBvID === video.bvid;

    return <ListItem style={style} className={`bilibili-video-item ${isPlaying ? 'playing' : ''}`}>
        <ListItemAvatar className="bilibili-video-item-avatar">
            <img src={urlPrefixFixed(video.pic)} alt={video.title} style={{ height: 40 }} />
            <div className="playing-cover"><PlayCircleIcon /></div>
        </ListItemAvatar>
        <ListItemText
            primary={htmlTitle ? <span dangerouslySetInnerHTML={{__html: video.title}}></span> : video.title}
            secondary={<Stack component="span" direction="row" spacing={1} sx={{ marginTop: '8px' }}>
                {showAuthor ? <Chip
                    component="span"
                    color="primary"
                    size="small"
                    variant="outlined"
                    icon={<PersonIcon />}
                    label={video.author}
                /> : null}
                <Chip
                    component="span"
                    color="primary"
                    size="small"
                    variant="outlined"
                    icon={<AccessTimeFilledIcon />}
                    label={fullCreateTime ? dayjs(video.created * 1000).format("YYYY年MM月DD日 HH:mm") : dayjs(video.created * 1000).fromNow()}
                />
                <Chip
                    component="span"
                    size="small"
                    variant="outlined"
                    icon={<PlayCircleFilledIcon />}
                    label={formatNumber10K(video.play)}
                />
                <Chip
                    component="span"
                    size="small"
                    variant="outlined"
                    icon={<ChatIcon />}
                    label={formatNumber10K(video.comment)}
                />
            </Stack>}
        />
        {fromSearch ? <div className="bilibili-video-item-sider">
            <Tooltip title="添加到收藏">
                <IconButton onClick={() => handleAddToFavClick()}>
                    <AddIcon />
                </IconButton>
            </Tooltip>
        </div> : <div className="bilibili-video-item-sider">
            <Tooltip title="立即播放">
                <IconButton onClick={() => handlePlayClick()}>
                    <PlayCircleIcon />
                </IconButton>
            </Tooltip>
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
        </div>}
        <AddFavDialog
            open={favListDialogOpen}
            onClose={() => setFavListDialogOpen(false)}
            excludeFavId={favId}
            video={video}
            formSearch={fromSearch}
        />
    </ListItem>;
}

VideoItem.propTypes = {
    video: PropTypes.shape({
        title: PropTypes.string,
        pic: PropTypes.string,
        created: PropTypes.number,
    }),
    fullCreateTime: PropTypes.bool,
    addBtn: PropTypes.bool,
    addToPlayBtn: PropTypes.bool,
    fromSearch: PropTypes.bool,
    removeBtn: PropTypes.bool,
    showAuthor: PropTypes.bool,
    onRemove: PropTypes.func,
    favId: PropTypes.string,
    htmlTitle: PropTypes.bool,
}

export default VideoItem;