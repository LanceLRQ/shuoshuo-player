import React, {useCallback, useState, useRef} from 'react';
import {Avatar, Box, Paper, IconButton, InputBase, Typography, Stack, Button} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import {SlicerHuman} from "@/constants";
import API from '@/api';
import VideoItem from "@player/components/video_item";
import {searchResultConverter} from "@player/utils";
import FavEditDialog from "@player/dialogs/fav_edit";
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';
import InfiniteLoader from "react-window-infinite-loader";

const DiscoveryPage = () => {
    const [mode, setMode] = useState('index');
    const [keyword, setKeyword] = useState('');
    const [pagerInfo, setPagerInfo] = useState({
        page: 1, page_size: 20, total: 0,
    });
    const [results, setResults] = useState([]);
    const [itemStatusMap, setItemStatusMap] = useState({});

    const favEditDgRef = useRef();

    const doSearch = useCallback(() => {
        if (!keyword) {
            setMode('index');
            return;
        }
        API.Bilibili.VideoApi.searchVideo({
            params: {
                search_type: 'video',
                keyword,
                page: 1,
            }
        }).then(response => {

            setPagerInfo({
                page: response?.page ?? 1,
                page_size: response?.pagesize ?? 20,
                total: response?.numResults ?? 0,
            });
            const ret = searchResultConverter(response?.result ?? []);
            setResults(ret);
            const iMap = {};
            for (let index = 0; index <= ret.length; index++) {
                iMap[index] = 2;  // LOADING
            }
            setItemStatusMap(iMap);
            setMode('search');
        }).catch(e => {

        })
    }, [keyword]);

    const renderResultListItem = ({ index, style }) => {
        const video = results[index];
        if (!video) return null;
        return <VideoItem
            style={style}
            key={video.bvid}
            video={video}
            htmlTitle
            fromSearch
        />
    };
    const isItemLoaded = index => !!itemStatusMap[index];
    const loadMoreItems = (startIndex, stopIndex) => {
        const iMap = {...itemStatusMap};
        for (let index = startIndex; index <= stopIndex; index++) {
            iMap[index] = 1;  // LOADING
        }
        setItemStatusMap(iMap);
        return new Promise((resolve, reject) =>
            API.Bilibili.VideoApi.searchVideo({
                params: {
                    search_type: 'video',
                    keyword,
                    page: Math.ceil(startIndex / pagerInfo.page_size),
                }
            }).then(response => {
                setPagerInfo({
                    page: response?.page ?? 1,
                    page_size: response?.pagesize ?? 20,
                    total: response?.numResults ?? 0,
                });
                setResults([
                    ...results,
                    ...searchResultConverter(response?.result ?? [])
                ]);
                const iMap = {...itemStatusMap};
                for (let index = startIndex; index <= stopIndex; index++) {
                    iMap[index] = 2;  // LOADING
                }
                setItemStatusMap(iMap);
            }).catch(e => {
                reject(e);
            })
        );
    }

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
                    onKeyDown={(e) => {
                        if (e.keyCode === 13) {
                            doSearch();
                        }
                    }}
                />
                {!keyword || mode === 'index' ? <IconButton
                    type="button"
                    sx={{ p: '10px' }}
                    aria-label="search"
                    onClick={() => {doSearch(); }}
                >
                    <SearchIcon />
                </IconButton> : <IconButton
                    type="button"
                    sx={{ p: '10px' }}
                    aria-label="clear"
                    onClick={() => {setKeyword(''); setMode('index'); }}
                >
                    <ClearIcon />
                </IconButton>}
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
                                <Button onClick={() => { favEditDgRef.current.showDialog({ mid: item.mid, name: `${item.name}的歌单` }); }}>添加歌单</Button>
                                <Button onClick={() => window.open(`https://space.bilibili.com/${item.mid}`)}>去TA空间</Button>
                            </Stack>
                        </Box>
                    </Box>;
                })}
            </Box>
        </Box> : null}
        {mode === 'search' ? <Box className="discovery-search-list">
            <Box sx={{width: '100%', height: '100%', bgcolor: 'background.paper'}}>
                <AutoSizer>
                    {({height, width}) => {
                        return <InfiniteLoader
                            isItemLoaded={isItemLoaded}
                            itemCount={pagerInfo.total > 520 ? 520 : pagerInfo.total}
                            loadMoreItems={loadMoreItems}
                            minimumBatchSize={pagerInfo.page_size}
                            threshold={5}
                        >
                            {({ onItemsRendered, ref }) => (<FixedSizeList
                                height={height}
                                width={width}
                                itemSize={108}
                                itemCount={results.length}
                                onItemsRendered={onItemsRendered}
                                ref={ref}
                                overscanCount={5}
                            >
                                {renderResultListItem}
                            </FixedSizeList>)}
                        </InfiniteLoader>
                    }}
                </AutoSizer>
            </Box>
        </Box> : null}
        <FavEditDialog ref={favEditDgRef} />
    </Box>;
}

export default DiscoveryPage;