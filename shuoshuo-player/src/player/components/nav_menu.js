import React, { useEffect, useState } from 'react';
import {
    List, ListItem, ListItemIcon, ListItemText, ListItemButton,
    Drawer as MuiDrawer, Toolbar, IconButton, Divider
} from "@mui/material";
import { styled } from '@mui/material/styles';
import HomeIcon from '@mui/icons-material/Home';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import FavoriteIcon from '@mui/icons-material/Favorite';
import {useNavigate, useMatch} from "react-router";

const drawerWidth = 240;

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
    ({ theme, open }) => ({
        '& .MuiDrawer-paper': {
            position: 'relative',
            whiteSpace: 'nowrap',
            width: drawerWidth,
            transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
            }),
            boxSizing: 'border-box',
            ...(!open && {
                overflowX: 'hidden',
                transition: theme.transitions.create('width', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                }),
                width: theme.spacing(7),
                [theme.breakpoints.up('sm')]: {
                    width: theme.spacing(7),
                },
            }),
        },
    }),
);

const NavMenu = (props) => {

    const { menuOpen, toggleMenu } = props;

    const match = useMatch("/:key/:p1?");
    const navigate = useNavigate();

    const ignoreKey = ['fav_list:add']
    const MenuMapping = [
        { label: '首页', key: 'index', icon: <HomeIcon /> },
        { label: '搜索', key: 'search', icon: <ManageSearchIcon /> },
        { label: '最近播放', key: 'recent', icon: <ScheduleIcon /> },
        { type: 'divider' },
        { label: '说说Crystal', key: 'fav:main', icon: <FavoriteIcon /> },
        { type: 'fav' },
        { label: '创建歌单', key: 'fav:add', icon: <PlaylistAddIcon /> },
    ]

    const [value, setValue] = useState('index');
    const handleMenuClick = (value) => () => {
        if (!value || ignoreKey.indexOf(value) > -1) return;
        const keys = value.split(':');
        if (keys[0] === 'fav') {
            navigate(`/${keys[0]}/${keys[1]}`);
        } else {
            navigate(`/${keys[0]}`);
        }
    };

    useEffect(() => {
        const matchKey = match?.params?.key ?? 'index';
        const matchP1 = match?.params?.p1 ?? '';
        setValue(matchP1 ? `${matchKey}:${matchP1}` : matchKey);

    }, [match]);

    return <Drawer variant="permanent" open={menuOpen}>
        <Toolbar
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                px: [1],
            }}
        >
            <IconButton onClick={toggleMenu}>
                <ChevronLeftIcon />
            </IconButton>
        </Toolbar>
        <Divider />
        <List component="nav">
            {MenuMapping.map((item, index) => {
                if (item.type === 'divider') {
                    return <Divider key={`divider_${index}`}></Divider>
                } else if (item.type === 'fav') {
                    return [{}].map(mItem => {
                        // TODO
                        return <ListItem
                            key="test1"
                            disablePadding
                        >
                            <ListItemButton>
                                <ListItemIcon>
                                    <QueueMusicIcon />
                                </ListItemIcon>
                                <ListItemText primary="自定义歌单1" />
                            </ListItemButton>
                        </ListItem>
                    })
                }
                else {
                    return <ListItem
                        key={item.key}
                        disablePadding
                    >
                        <ListItemButton selected={value === item.key} onClick={handleMenuClick(item.key)}>
                            <ListItemIcon>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.label} />
                        </ListItemButton>
                    </ListItem>
                }
            })}
        </List>
    </Drawer>;
};

export default NavMenu