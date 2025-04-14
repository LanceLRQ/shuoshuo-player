import React, {useEffect, useMemo} from 'react';
import {
    Grid, Box, Chip, IconButton, Toolbar, Typography,
    ButtonGroup, Button
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LRCSearchDialog from "@player/dialogs/lrc_search";
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";
import isElectron from "is-electron";
import {useSelector} from "react-redux";
import {LyricSlice} from "@/store/lyric";
import { Lrc as LrcKit } from 'lrc-kit';
import LyricEditorTable from "@player/components/cloud_services/lyric_editor_table";

const LyricEditor = (props) => {
    const { currentMusic, setEditorMode } = props;
    const inElectron = isElectron();
    const [currentLyric, setCurrentLyric] = React.useState(LrcKit.parse(''));
    const [suggestedLyrics, setSuggestedLyrics] = React.useState(LrcKit.parse(''));

    const LrcInfos = useSelector(LyricSlice.selectors.lyricMaps)
    const LrcInfo = useMemo(() => {
        if (!currentMusic) return {};
        return LrcInfos[currentMusic.bvid]?? {};
    }, [currentMusic, LrcInfos]);

    useEffect(() => {
        if (LrcInfo) {
            setCurrentLyric(LrcKit.parse(LrcInfo.lrc));
        } else {
            setCurrentLyric(LrcKit.parse(''))
        }
    }, [LrcInfo])

    const handleSaveLyric = () => {

    }

    const handleManualUseLyric = () => {

    }

    return <>
        <Box className="player-lyric-top-bar" sx={{flexGrow: 1}}>
            <Toolbar>
                <IconButton size="large" aria-label="close lyric" sx={{mr: 2}} onClick={() => setEditorMode(false)}>
                    <ArrowBackIcon/>
                </IconButton>
                <Typography noWrap={true} variant="h6" component="div" sx={{flexGrow: 1}}>
                    <Chip label="编辑歌词" /> {currentMusic?.name}
                </Typography>
                <Box sx={{display: {xs: 'none', md: 'flex'}}}>
                    {inElectron && <LRCSearchDialog bvid={currentMusic.bvid} onManualUseLyric={handleManualUseLyric}>
                        {(slot) => {
                            return <IconButton onClick={() => slot.handleOpen(currentMusic?.name ?? '')}>
                                <SearchIcon/>
                            </IconButton>
                        }}
                    </LRCSearchDialog>}
                    {<IconButton onClick={handleSaveLyric}>
                        <SaveIcon></SaveIcon>
                    </IconButton>}
                </Box>
            </Toolbar>
        </Box>
        <Grid container spacing={2}>
            <Grid item xs={5}>
                <Typography variant="h6" align="center">当前歌词</Typography>
            </Grid>
            <Grid item xs={2}></Grid>
            <Grid item xs={5}>
                <Typography variant="h6" align="center">参考歌词</Typography>
            </Grid>
        </Grid>
        <Box className="player-lyric-content">
            <Grid container spacing={2} className="player-lyric-editor">
                <Grid item xs={5} className="player-lyric-editor-left">
                    <LyricEditorTable lyrics={currentLyric.lyrics} />
                </Grid>
                <Grid item xs={2}>
                    <ButtonGroup
                        orientation="vertical"
                        aria-label="歌词操作"
                        variant="text"
                    >
                        <Button> &lt;&lt; 插入全部歌词 </Button>
                        <Button> &lt; 插入所选歌词 </Button>
                    </ButtonGroup>
                </Grid>
                <Grid item xs={5}>
                    <LyricEditorTable lyrics={suggestedLyrics.lyrics} />
                </Grid>
            </Grid>
        </Box>
    </>
}

export default LyricEditor;