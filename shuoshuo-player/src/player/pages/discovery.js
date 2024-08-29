import React, {useCallback, useState, useMemo} from 'react';
import {Avatar, Box, Paper, IconButton, InputBase, Typography, Stack, Button, List} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import {SlicerHuman} from "@/constants";
import API from '@/api';
import VideoItem from "@player/components/video_item";
import {searchResultConverter} from "@player/utils";

const DiscoveryPage = () => {
    const [mode, setMode] = useState('index');
    const [keyword, setKeyword] = useState('');
    const [response, setResponse] = useState(null);
    const [reqPage, setReqPage] = useState(1);

    const doSearch = useCallback(() => {
        API.Bilibili.VideoApi.searchVideo({
            params: {
                search_type: 'video',
                keyword,
                page: reqPage,
            }
        }).then(results => {
            setResponse(results);
            setMode('search');
        }).catch(e => {

        })
    }, [keyword, reqPage]);

    const results = useMemo(() => {
        return searchResultConverter(response?.result ?? []);
    }, [response])

    const pagerInfo = useMemo(() => {
        return {
            page: response?.page ?? 1,
            page_size: response?.pagesize ?? 20,
            total: response?.numResults ?? 0,
        }
    }, [response]);

    return <Box className={`player-discovery-main ${mode === 'search' ? 'mode-search' : ''}`}>
        <Box className="discovery-search-bar">
            <Paper
                className="discovery-search-box"
                sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400 }}
            >
                <InputBase
                    sx={{ ml: 1, flex: 1 }}
                    placeholder="请输入视频关键字"
                    inputProps={{ 'aria-label': '请输入视频关键字' }}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <IconButton
                    type="button"
                    sx={{ p: '10px' }}
                    aria-label="search"
                    onClick={() => {setReqPage(1); doSearch(); }}
                >
                    <SearchIcon />
                </IconButton>
            </Paper>
        </Box>
        {mode === 'index' ? <Box className="discovery-slicer-human">
            <Box className="slicer-box-title"><Typography  variant="h6">切片Man</Typography></Box>
            <Box className="discovery-slicer-human-container">
                {SlicerHuman.map((item) => {
                    return <Box className="slicer-card" key={item.mid}>
                        <Avatar className="slicer-avatar" sx={{ width: 64, height: 64 }} src={item.face} />
                        <Box className="slicer-meta">
                            <Typography className="slicer-name" variant="h7">{item.name}</Typography>
                            <Stack direction="row" spacing={2}>
                                <Button>添加歌单</Button>
                                <Button onClick={() => window.open(`https://space.bilibili.com/${item.mid}`)}>去TA空间</Button>
                            </Stack>
                        </Box>
                    </Box>;
                })}
            </Box>
        </Box> : null}
        {mode === 'search' ? <Box className="discovery-search-list">
            <List sx={{width: '100%', bgcolor: 'background.paper'}}>
                {results.map((video, index) => {
                    return <VideoItem
                        key={video.bvid}
                        video={video}
                        htmlTitle
                    />
                })}
            </List>
        </Box> : null}
    </Box>;
}

export default DiscoveryPage;