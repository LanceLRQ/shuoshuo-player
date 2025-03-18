import { useSelector, useDispatch} from "react-redux";
import React, {useCallback, useState} from "react";
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
    const handleOpenPopover = (event) => {
        setPopEl(event.currentTarget);
    };
    const handleClosePopover = () => {
        setPopEl(null);
    }

    const handleDbClickMusic = useCallback((index) => {
        dispatch(PlayingListSlice.actions.updateCurrentPlaying({
            index: index,
            playNext: true,
        }))
    }, [dispatch]);

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
                                    <IconButton edge="end" size="small">
                                        <DeleteIcon fontSize="10px"/>
                                    </IconButton>
                                </Grid>
                            </Grid>
                        </ListSubheader>
                    }
                >
                    {playingList.map((video, index) => {
                        return <ListItem
                            className={playingInfo?.current === video.bvid  ? 'splayer-playing-item-active' : ''}
                            key={video.bvid}
                            secondaryAction={
                                <IconButton edge="end" size="small">
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
                                onClick={() => handleDbClickMusic(index)}
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