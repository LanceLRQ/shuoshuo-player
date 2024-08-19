import React, {useCallback, useMemo} from 'react';
import { useParams } from "react-router";
import {Box, List, Typography} from "@mui/material";
import VideoItem from "@player/components/video_item";
import {useDispatch, useSelector} from "react-redux";
import {MasterVideoListSelector} from "@/store/selectors/bilibili";
import {FavListType, MasterUpInfo} from "@/constants";
import {PlayingListSlice, FavListSlice} from "@/store/play_list";
import BilibiliUpSpaceCard from '../components/bup_card';

export const FavListPage = (props) => {
    const dispatch = useDispatch();
    const params = useParams();
    let favId =  params?.id ?? 'main';

    const masterVideoListAll = useSelector(MasterVideoListSelector);
    const favList = useSelector(FavListSlice.selectors.favList);
    const favListInfo = useMemo(() => {
        if (favId === 'main') {
            return {
                id: 'main',
                type: FavListType.UPLOADER,
                name: `${MasterUpInfo.uname}的歌单`,
                mid: MasterUpInfo.mid,
            }
        }
        return favList.find(item => item.id === favId);
    }, [favId, favList])

    const masterVideoList = useMemo(() => {
        if (favId === 'main') {
            return masterVideoListAll[MasterUpInfo.mid] ?? []
        }
        return [];
    }, [favId, masterVideoListAll]);

    const biliMid = useMemo(() => {
        if (favId === 'main') {
            return MasterUpInfo.mid;
        }
        return 0; //TODO
    }, [favId])

    const handlePlayItemClick = useCallback((video) => {
        dispatch(PlayingListSlice.actions.addSingle({
            bvId: video.bvid,
            playNow: false
        }));
    }, [dispatch])

    return favListInfo ? <section className="player-fav-list">
        <BilibiliUpSpaceCard favId={favId} mid={biliMid} favListInfo={favListInfo} />
        <Box className="fav_item_list">
            <List sx={{width: '100%', bgcolor: 'background.paper'}}>
                {masterVideoList.map((video, index) => {
                    if (!video || index > 30) return null;
                    return <VideoItem
                        fullCreateTime
                        key={video.bvid}
                        video={video}
                        playNowBtn={false}
                        onDirect={(item) => {
                            window.open('https://bilibili.com/video/' + item.bvid);
                        }}
                        onPlay={handlePlayItemClick}
                    />
                })}
            </List>
        </Box>
    </section> : <section className="player-fav-list">
        <Typography variant="h4">歌单信息不存在</Typography>
    </section>;
}

export default FavListPage;