import React, {useEffect, useRef, useState} from 'react';
import {
    List, ListItem, ListItemIcon, ListItemText, ListItemButton,
    Drawer as MuiDrawer, Toolbar, IconButton, Divider, Avatar
} from "@mui/material";
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { noop, flatten } from 'lodash';
import { styled } from '@mui/material/styles';
import HomeIcon from '@mui/icons-material/Home';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import FavoriteIcon from '@mui/icons-material/Favorite';
import {useNavigate, useMatch} from "react-router";
import {FavListType, MasterUpInfo} from "@/constants";
import {FavListSlice} from "@/store/play_list";
import FavEditDialog from "@player/components/fav_edit";
import {BilibiliUserVideoListSlice} from "@/store/bilibili";

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

    const { menuOpen, toggleMenu = noop } = props;
    const favEditDgRef = useRef();

    const match = useMatch("/:key/:p1?");
    const navigate = useNavigate();

    const FavList = useSelector(FavListSlice.selectors.favList);
    const spaceInfos = useSelector(BilibiliUserVideoListSlice.selectors.spaceInfo);

    const ignoreKey = ['fav_list:add']
    const MenuMapping = [
        { label: '首页', key: 'index', icon: <HomeIcon /> },
        { label: '搜索&发现', key: 'search', icon: <ManageSearchIcon /> },
        // { label: '最近播放', key: 'recent', icon: <ScheduleIcon /> },
        { type: 'divider' },
        { label: MasterUpInfo.uname, key: 'fav:main', icon: <FavoriteIcon /> },
        { type: 'fav' },
        { label: '创建歌单', key: 'fav:add', icon: <PlaylistAddIcon /> },
    ]

    const [value, setValue] = useState('index');
    const handleMenuClick = (value) => () => {
        if (!value || ignoreKey.indexOf(value) > -1) return;
        const keys = value.split(':');
        if (keys[0] === 'fav') {
            if (keys[1] === 'add') {
                favEditDgRef.current.showDialog({});
                return;
            }
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


    return <>
        <Drawer variant="permanent" open={menuOpen}>
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
                {flatten(MenuMapping.map((item, index) => {
                    if (item.type === 'divider') {
                        return <Divider key={`divider_${index}`}></Divider>
                    } else if (item.type === 'fav') {
                        return FavList.map(favItem => {
                            const isUploader = favItem.type === FavListType.UPLOADER;
                            const spaceInfo = isUploader ? spaceInfos[favItem.mid] : null;
                            return <ListItem
                                key={favItem.id}
                                disablePadding
                            >
                                <ListItemButton selected={value === `fav:${favItem.id}`} onClick={handleMenuClick(`fav:${favItem.id}`)}>
                                    <ListItemIcon>
                                        {isUploader ? (spaceInfo ? <Avatar sx={{ width: 24, height: 24 }} src={spaceInfo.face} /> :  <VideoCameraFrontIcon />) : <QueueMusicIcon />}
                                    </ListItemIcon>
                                    <ListItemText primary={favItem.name} />
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
                }))}
            </List>
        </Drawer>
        <FavEditDialog ref={favEditDgRef} />
    </>;
};
NavMenu.propTypes = {
    menuOpen: PropTypes.bool,
    toggleMenu: PropTypes.func,
}

export default NavMenu