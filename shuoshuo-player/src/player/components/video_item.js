import React from 'react';
import PropTypes from 'prop-types';
import dayjs from "dayjs";
import {Chip, ListItem, ListItemAvatar, ListItemText, IconButton, Stack, Tooltip} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayCircleIcon from '@mui/icons-material/PlayCircleOutline';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import ChatIcon from '@mui/icons-material/Chat';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import AddCircleIcon from '@mui/icons-material/AddCircleOutline';
import {formatNumber10K} from "@player/utils";


const VideoItem = (props) => {
    const { video, fullCreateTime } = props;
    return <ListItem className="bilibili-video-item">
        <ListItemAvatar className="bilibili-video-item-avatar">
            <img src={video.pic} alt={video.title} style={{ height: 40 }} />
        </ListItemAvatar>
        <ListItemText
            primary={video.title}
            secondary={<Stack component="span" direction="row" spacing={1} sx={{ marginTop: '8px' }}>
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
        <div className="bilibili-video-item-sider">
            <Tooltip title="去B站看">
                <IconButton onClick={() => props.onDirect(video)}>
                    <OpenInNewIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title={props.playNow ? '立即播放' : '添加到播放列表'}>
                <IconButton onClick={() => props.onPlay(video, !!props.playNow)}>
                    {props.playNow ? <PlayCircleIcon /> : <AddCircleIcon />}
                </IconButton>
            </Tooltip>
        </div>
    </ListItem>;
}

VideoItem.propTypes = {
    video: PropTypes.shape({
        title: PropTypes.string,
        pic: PropTypes.string,
        created: PropTypes.number,
    }),
    fullCreateTime: PropTypes.bool,
    onPlay: PropTypes.func,   // () => (videoInfo, playNow)
    onDirect: PropTypes.func,
    playNow: PropTypes.bool,
}

export default VideoItem;