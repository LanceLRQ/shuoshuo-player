import { useSelector, useDispatch} from "react-redux";
import React, {useCallback, useState, useRef, useEffect} from "react";
import {
    Popover, List, ListSubheader, Avatar, IconButton,
    ListItem, ListItemIcon, ListItemAvatar, Grid,
} from '@mui/material';
import {urlPrefixFixed} from "@player/utils";
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import {PlayingVideoListSelector} from "@/store/selectors/play_list";
import {PlayingListSlice} from "@/store/play_list";

const PlayingList = (props) => {
    const dispatch = useDispatch();
    const [popEl, setPopEl] = useState(null);
    const openPopover = Boolean(popEl);
    const playingList = useSelector(PlayingVideoListSelector);
    const playingInfo = useSelector(PlayingListSlice.selectors.current);
    const targetItemRef = useRef(null);
    const handleOpenPopover = (event) => {
        setPopEl(event.currentTarget);
    };
    const handleClosePopover = () => {
        setPopEl(null);
    }

    const handleMusicClick = useCallback((index) => {
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: index,
            playNext: true,
        }))
    }, [dispatch]);

    const handleRemoveClick = useCallback((bvId) => {
        dispatch(PlayingListSlice.actions.syncPlaylistDelete({
            mode: 'single',
            audioKey: bvId,
        }))
    }, [dispatch]);

    const handleEmptyPlaylistClick = useCallback(() => {
        dispatch(PlayingListSlice.actions.syncPlaylistDelete({
            mode: 'fully',
        }))
    }, [dispatch]);

    // 在 Popover 打开后，滚动到目标列表项
    useEffect(() => {
        if (openPopover) {
            // 延迟 100ms，确保 List 组件完全渲染
            setTimeout(() => {
                if (targetItemRef.current) {
                    targetItemRef.current.scrollIntoView({behavior: 'auto', block: 'center'});
                }
            }, 100);
        }
    }, [openPopover]);

    return <>
        <Popover
            id="splayer-playing-list-popover"
            open={openPopover}
            anchorEl={popEl}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
            onClose={handleClosePopover}
        >
            <div className="splayer-playing-list">
                <List
                    component="nav"
                    subheader={
                        <ListSubheader component="div">
                            <Grid
                                container
                                direction="row"
                                sx={{
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <Grid item>
                                    播放列表({playingList.length})
                                </Grid>
                                <Grid item>
                                    <IconButton edge="end" size="small" onClick={handleEmptyPlaylistClick}>
                                        <DeleteIcon fontSize="10px"/>
                                    </IconButton>
                                </Grid>
                            </Grid>
                        </ListSubheader>
                    }
                >
                    {playingList.map((video, index) => {
                        return <ListItem
                            ref={playingInfo?.current === video.bvid  ? targetItemRef : null}
                            className={playingInfo?.current === video.bvid  ? 'splayer-playing-item-active' : ''}
                            key={video.bvid}
                            secondaryAction={
                                <IconButton edge="end" size="small" onClick={() => handleRemoveClick(video.bvid)}>
                                    <ClearIcon fontSize="10px"/>
                                </IconButton>
                            }
                        >
                            <ListItemIcon>
                                <ListItemAvatar>
                                    <Avatar src={urlPrefixFixed(video.pic)} alt={video.title} sx={{ height: 24, width: 24 }} />
                                </ListItemAvatar>
                            </ListItemIcon>
                            <div
                                className="splayer-playing-item-title"
                                title={video.title}
                                onClick={() => handleMusicClick(index)}
                            >
                                {video.title}
                            </div>
                        </ListItem>
                    })}
                </List>
            </div>
        </Popover>
        {props.children({open: handleOpenPopover})}
    </>
}

export default PlayingList;