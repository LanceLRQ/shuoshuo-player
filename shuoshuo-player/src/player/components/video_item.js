import React from 'react';
import PropTypes from 'prop-types';
import dayjs from "dayjs";
import { Chip, ListItem, ListItemAvatar, ListItemText, IconButton, Stack } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayCircleIcon from '@mui/icons-material/PlayCircleOutline';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import ChatIcon from '@mui/icons-material/Chat';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import {formatNumber10K} from "@player/utils";


const VideoItem = (props) => {
    const { video } = props;
    return <ListItem className="bilibili-video-item">
        <ListItemAvatar className="bilibili-video-item-avatar">
            <img src={video.pic} alt={video.title} style={{ height: 40 }} />
        </ListItemAvatar>
        <ListItemText
            primary={video.title}
            secondary={<Stack direction="row" spacing={1} sx={{ marginTop: '8px' }}>
                <Chip
                    color="primary"
                    size="small"
                    variant="outlined"
                    icon={<AccessTimeFilledIcon />}
                    label={dayjs(video.created * 1000).fromNow()}
                />
                <Chip
                    size="small"
                    variant="outlined"
                    icon={<PlayCircleFilledIcon />}
                    label={formatNumber10K(video.play)}
                />
                <Chip
                    size="small"
                    variant="outlined"
                    icon={<ChatIcon />}
                    label={formatNumber10K(video.comment)}
                />
            </Stack>}
        />
        <div className="bilibili-video-item-sider">
            <IconButton onClick={() => props.onDirect(video)}>
                <OpenInNewIcon />
            </IconButton>
            <IconButton onClick={() => props.onPlay(video)}>
                <PlayCircleIcon />
            </IconButton>
        </div>
    </ListItem>;
}

VideoItem.propTypes = {
    video: PropTypes.arrayOf(PropTypes.shape({
        title: PropTypes.string,
        pic: PropTypes.string,
        created: PropTypes.number,
    })),
    onPlay: PropTypes.func,
    onDirect: PropTypes.func,
}

export default VideoItem;