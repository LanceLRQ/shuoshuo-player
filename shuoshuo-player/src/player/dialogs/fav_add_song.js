import React, {useState, forwardRef, useImperativeHandle, useCallback} from 'react';
import {
    Box, Button, TextField, Dialog, DialogTitle, DialogActions, DialogContent,
    DialogContentText

} from '@mui/material';
import PropTypes from "prop-types";
import {useDispatch} from "react-redux";
import {FavListSlice} from "@/store/play_list";
import {PlayerNoticesSlice} from "@/store/ui";
import {NoticeTypes} from "@/constants";


const AddSongDialog = forwardRef((props, ref) => {
    const { favId } = props;
    const [open, setOpen] = useState(false);
    const [songText, setSongText] = useState('');
    const dispatch = useDispatch();

    const showDialog = () => {
        setOpen(true);
        setSongText('')
    };

    const handleClose = () => {
        setOpen(false);
    };

    const handleAdd = useCallback(() => {
        const bvIdMatchs = songText.match(/BV([a-zA-Z0-9]{10})/g);
        if (!bvIdMatchs || !bvIdMatchs.length) {
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.ERROR,
                message: '没有解析到有效的BVID',
                duration: 3000,
            }));
            return;
        }
        dispatch(FavListSlice.actions.addFavVideoByBvids({
            bvIds: bvIdMatchs, favId
        }));
        setOpen(false);
    }, [dispatch, songText, favId]);

    useImperativeHandle(ref, () => ({
        showDialog,
    }))

    return <Dialog
        open={open}
        onClose={handleClose}
    >
        <DialogTitle>添加歌曲</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    支持解析B站视频地址、BV号，多个地址请以换行隔开。
                </DialogContentText>
                <Box
                    sx={{
                        marginTop: 2,
                        width: 480,
                        maxWidth: '100%',
                    }}
                >
                <TextField
                    autoFocus
                    required
                    value={songText}
                    label="视频地址"
                    placeholder="e.g. https://www.bilibili.com/video/BV17x411w7KC"
                    onChange={(e) => setSongText(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={4}
                    variant="standard"
                />
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={handleClose}>取消</Button>
            <Button onClick={handleAdd}>确定</Button>
        </DialogActions>
    </Dialog>;
})

AddSongDialog.propTypes = {
    favId: PropTypes.string.isRequired,
}

export default AddSongDialog;