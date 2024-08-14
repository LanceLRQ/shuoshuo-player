import React, {useMemo} from 'react';
import { useParams } from "react-router";
import {List} from "@mui/material";
import VideoItem from "@player/components/video_item";
import {useSelector} from "react-redux";
import {MasterVideoListSelector} from "@/store/selectors/bilibili";
import {MasterUpInfo} from "@/constants";

export const FavListPage = (props) => {
    const params = useParams();
    let favId =  params?.id ?? 'main';

    const masterVideoListAll = useSelector(MasterVideoListSelector);
    const masterVideoList = useMemo(() => {
        if (favId === 'main') {
            return masterVideoListAll[MasterUpInfo.mid] ?? []
        }
        return [];
    }, [favId, masterVideoListAll]);

    return <section className="player-fav-list">
        <List sx={{width: '100%', bgcolor: 'background.paper'}}>
            {masterVideoList.map((video, index) => {
                if (!video || index > 30) return null;
                return <VideoItem
                    fullCreateTime
                    key={video.bvid}
                    video={video}
                    onDirect={(item) => {
                        window.open('https://bilibili.com/video/' + item.bvid);
                    }}
                />
            })}
        </List>
    </section>
}

export default FavListPage;