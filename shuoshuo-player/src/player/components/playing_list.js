import { useSelector} from "react-redux";
import React, {useState} from "react";
import {
    Popover, List, ListSubheader, Avatar, IconButton,
    ListItem, ListItemIcon, ListItemAvatar, ListItemText
} from '@mui/material';
import {urlPrefixFixed} from "@player/utils";
import ClearIcon from '@mui/icons-material/Clear';
import {PlayingVideoListSelector} from "@/store/selectors/play_list";
import {PlayingListSlice} from "@/store/play_list";

const PlayingList = (props) => {
    // const dispatch = useDispatch();
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
                            播放列表({playingList.length})
                        </ListSubheader>
                    }
                >
                    {playingList.map((video) => {
                        return <ListItem
                            secondaryAction={
                                <IconButton edge="end">
                                    <ClearIcon />
                                </IconButton>
                            }
                        >
                            <ListItemIcon>
                                <ListItemAvatar>
                                    <Avatar src={urlPrefixFixed(video.pic)} alt={video.title} sx={{ height: 24, width: 24 }} />
                                </ListItemAvatar>
                            </ListItemIcon>
                            <div
                                className={`splayer-playing-item-title splayer-playing-item-title-${playingInfo?.current === video.bvid ? 'active' : ''}`}
                                title={video.title}
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