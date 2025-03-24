import React, { useState, useCallback} from 'react';
import {
    Dialog, DialogTitle, DialogContent, IconButton, TextField, Button,
    Divider, List, ListItem, ListItemText, Stack, Box, Typography, DialogActions
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIco from '@mui/icons-material/Search';
import { Lrc as ReactLRC } from "react-lrc";
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import isElectron from 'is-electron';
import {formatMillisecond, removeEmptyLRCItem} from "@/utils";
import {useDispatch} from "react-redux";
import {LyricSlice} from "@/store/lyric";


const LRCSearchDialog = (props) => {
    const { bvid = '' } = props;
    const [open, setOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [songList, setSongList] = useState([]);
    const [mode, setMode] = useState('list');
    const [lrcResp, setLrcResp] = useState('');
    const inElectron = isElectron();

    const dispatch = useDispatch();

    const searchSongByKeyword = (keyword) => {
        window.ElectronAPI.Spider.QQMusic.SearchSong(keyword, 10).then(res => {
            if (!res.length) {
                alert('没有找到歌曲信息');
                return;
            }
            setSongList(res);
        });
    }

    const getSongLrcByMid = (mid) => {
        window.ElectronAPI.Spider.QQMusic.GetLRC(mid).then(res => {
            if (!res) {
                alert('读取歌词像信息错误');
                return;
            }
            setLrcResp(removeEmptyLRCItem(res));
            setMode('detail');
        });
    }

    const handleOpen = (defaultKeyword) => {
        if (!inElectron) {
            return;
        }
        setOpen(true);
        if (defaultKeyword) {
            setKeyword(defaultKeyword);
        } else {
            setKeyword('')
        }
        setMode('list');
        setSongList([]);
    }
    const handleClose = () => {
        setOpen(false);
    }

    const singerToText = (singers) => {
        if (singers && singers.length) {
            return singers.map(singers => singers?.title || singers?.name).join('、');
        }
        return ''
    }

    const handleViewMode = (mid) => {
        getSongLrcByMid(mid)
    }

    const handleUseLrc = useCallback(() => {
        dispatch(LyricSlice.actions.updateLyric({
            bvid: bvid,
            lrc: lrcResp,
            offset: 0,
            source: 'QQ音乐',
        }));
        handleClose();
    }, [dispatch, bvid, lrcResp]);

    return <>
        {props.children({
            handleOpen,
            handleClose
        })}
        <Dialog
            sx={{zIndex: 2000002}}
            open={open}
            onClose={handleClose}
            scroll="paper"
            maxWidth="sm"
            fullWidth={true}
        >
            <DialogTitle>{mode === 'detail' ? '预览歌词': '搜索歌词'}</DialogTitle>
            <IconButton
                aria-label="close"
                onClick={handleClose}
                sx={(theme) => ({
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon />
            </IconButton>
            {mode === 'detail' ? <DialogContent dividers>
                <Typography>
                    <ReactLRC
                        lrc={lrcResp}
                        lineRenderer={({ line }) => (
                            <p key={line.startMillisecond}>
                              <strong>
                                {formatMillisecond(line.startMillisecond)}
                              </strong>
                                &nbsp;
                                {line.content}
                            </p>
                        )}
                    />
                </Typography>
            </DialogContent> : <DialogContent dividers>
                <Stack direction="row" spacing={1}>
                    <TextField
                        fullWidth={true}
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        label="请输入关键词"
                        variant="outlined"
                    />
                    <Box sx={{lineHeight: "48px"}}>
                        <IconButton aria-label="search" onClick={() => { searchSongByKeyword(keyword) }}>
                            <SearchIco />
                        </IconButton>
                    </Box>
                </Stack>
                <Divider sx={{margin: "16px 0"}} />
                <List>
                    {songList && songList.length ? songList.map((song) => (<ListItem
                        key={song.mid}
                        secondaryAction={
                            <IconButton aria-label="view" onClick={() => handleViewMode(song.mid)}>
                                <KeyboardArrowRightIcon />
                            </IconButton>
                        }
                    >
                        <ListItemText
                            sx={{textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}
                            secondary={
                                <Typography variant="body2" component="span">
                                    演唱: {singerToText(song?.singer)}
                                </Typography>
                            }
                        >
                            {song?.title || song?.name}
                        </ListItemText>
                    </ListItem>)) : null}
                </List>
            </DialogContent>}
            {mode === 'detail' && <DialogActions>
                <Button autoFocus onClick={() => setMode('list')}>
                    后退
                </Button>
                <Button onClick={handleUseLrc}>使用</Button>
            </DialogActions>}
        </Dialog>
    </>
}

export default LRCSearchDialog;