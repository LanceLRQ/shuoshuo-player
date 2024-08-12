import React from 'react';
import {useDispatch, useSelector} from "react-redux";
import { Snackbar, Stack, Typography, IconButton } from '@mui/material';
import {NoticeTypes} from "@/constants";
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import {PlayerNoticesReducer} from "@/store/ui";
import {common, yellow, red, green} from '@mui/material/colors';

const IconMap = {
    [NoticeTypes.INFO]: InfoIcon,
    [NoticeTypes.WARN]: WarningIcon,
    [NoticeTypes.ERROR]: ErrorIcon,
    [NoticeTypes.SUCCESS]: CheckCircleIcon,
}
const IconColorMap = {
    [NoticeTypes.INFO]: common.white,
    [NoticeTypes.WARN]: yellow[500],
    [NoticeTypes.ERROR]: red[500],
    [NoticeTypes.SUCCESS]: green[500],
}

const NoticesBox = () => {
    const dispatch = useDispatch();
    const noticesList = useSelector(state => state.ui?.notices?.list ?? []);

    const handleClose = (item) => (e, reason) => {
        if (reason === 'clickaway') return;
        dispatch(PlayerNoticesReducer.actions.removeNotice({
            id: item.id,
        }));
    }

    return <>
        {noticesList.map((item) => {
            const Icon = IconMap[item.type];
            const color = IconColorMap[item.type];
            return <Snackbar
                anchorOrigin={{ vertical: item.vertical, horizontal: item.horizontal }}
                open={true}
                onClose={handleClose(item)}
                autoHideDuration={item.duration}
                message={<Stack spacing={2} direction="row">
                    <Icon sx={{color}} />
                    <Typography sx={{color}}>{item.message}</Typography>
                </Stack>}
                key={item.id}
                action={<Stack spacing={1} direction="row">
                    {item.action ? item.action : null}
                    {item.close ? <IconButton onClick={handleClose(item)}>
                        <CloseIcon sx={{color: common.white}} />
                    </IconButton> : null}
                </Stack>}
            />
        })}
    </>;
};

export default NoticesBox