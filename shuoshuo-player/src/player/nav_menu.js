import React from 'react';
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

    const ignoreKey = ['music_list:add']
    const MenuMapping = [
        { label: '首页', key: 'home', icon: <HomeIcon /> },
        { label: '搜索', key: 'search', icon: <ManageSearchIcon /> },
        { label: '最近播放', key: 'recent', icon: <ScheduleIcon /> },
        { type: 'divider' },
        { label: '说说Crystal', key: 'music_list:main', icon: <FavoriteIcon /> },
        { type: 'music_list' },
        { label: '创建歌单', key: 'music_list:add', icon: <PlaylistAddIcon /> },
    ]

    const [value, setValue] = React.useState(0);
    const handleMenuClick = (value) => () => {
        if (ignoreKey.indexOf(value) > -1) return;
        setValue(value);
    };

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
                } else if (item.type === 'music_list') {
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