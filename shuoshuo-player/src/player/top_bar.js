import React from 'react';
import { styled } from '@mui/material/styles';
import { AppBar as MuiAppBar, Toolbar, IconButton, Typography, Badge } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';

const drawerWidth = 240;

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const TopBar = (props) => {

    const { menuOpen, toggleMenu } = props;

    return  <AppBar position="absolute" open={menuOpen}>
        <Toolbar
            sx={{
                pr: '24px', // keep right padding when drawer closed
            }}
        >
            <IconButton
                edge="start"
                color="inherit"
                aria-label="open drawer"
                onClick={toggleMenu}
                sx={{
                    marginRight: '36px',
                    ...(menuOpen && { display: 'none' }),
                }}
            >
                <MenuIcon />
            </IconButton>
            <Typography
                component="h1"
                variant="h6"
                color="inherit"
                noWrap
                sx={{ flexGrow: 1 }}
            >
                说说Crystal播放器
            </Typography>
            <IconButton color="inherit">
                <Badge badgeContent={4} color="secondary">
                    <NotificationsIcon />
                </Badge>
            </IconButton>
        </Toolbar>
    </AppBar>;
};

export default TopBar;