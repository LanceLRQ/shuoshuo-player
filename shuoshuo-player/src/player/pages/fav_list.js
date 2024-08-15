import React, {useCallback, useMemo} from 'react';
import { useParams } from "react-router";
import {List} from "@mui/material";
import VideoItem from "@player/components/video_item";
import {useDispatch, useSelector} from "react-redux";
import {MasterVideoListSelector} from "@/store/selectors/bilibili";
import {MasterUpInfo} from "@/constants";
import {PlayingListSlice} from "@/store/play_list";

export const FavListPage = (props) => {
    const dispatch = useDispatch();
    const params = useParams();
    let favId =  params?.id ?? 'main';

    const masterVideoListAll = useSelector(MasterVideoListSelector);
    const masterVideoList = useMemo(() => {
        if (favId === 'main') {
            return masterVideoListAll[MasterUpInfo.mid] ?? []
        }
        return [];
    }, [favId, masterVideoListAll]);

    const handlePlayItemClick = useCallback((video) => {
        dispatch(PlayingListSlice.actions.addSingle({
            bvId: video.bvid,
            playNow: false
        }));
    }, [dispatch])

    return <section className="player-fav-list">
        <List sx={{width: '100%', bgcolor: 'background.paper'}}>
            {masterVideoList.map((video, index) => {
                if (!video || index > 30) return null;
                return <VideoItem
                    fullCreateTime
                    key={video.bvid}
                    video={video}
                    playNow={false}
                    onDirect={(item) => {
                        window.open('https://bilibili.com/video/' + item.bvid);
                    }}
                    onPlay={handlePlayItemClick}
                />
            })}
        </List>
    </section>
}

export default FavListPage;