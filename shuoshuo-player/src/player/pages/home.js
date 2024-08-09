import React, {useEffect, useState, useCallback, useMemo} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Grid } from '@mui/material';
import VideoAlbumCarousel from "@player/components/carousel";
import {readUserVideos} from "@player/utils";
import {MasterUpInfo} from "@/constants";
import {TimeStampNow} from "@/utils";

const HomePage = () => {
    const dispatch = useDispatch();
    const [loaded, setLoaded] = useState(false);
    const masterLastUpdateTime = useSelector((state) => state.caches?.user_video_list?.[MasterUpInfo.mid]?.update_time ?? 0);
    const masterVideoList = useSelector((state) => state.caches?.user_video_list?.[MasterUpInfo.mid]?.video_list ?? []);

    const updateMasterVideoList = useCallback(() => {
        readUserVideos(dispatch, MasterUpInfo.mid, {
            order: 'pubdate',
            platform: 'web',
        }).then(() => {
            setLoaded(true);
        });
    }, [dispatch, setLoaded])

    useEffect(() => {
        const isOutdated = (masterLastUpdateTime + 3600) < TimeStampNow();   // 一小时更新一次
        if (!masterLastUpdateTime || isOutdated) {
            updateMasterVideoList();
        } else {
            setLoaded(true);
        }
    }, [updateMasterVideoList, masterLastUpdateTime]);

    const slidesList = useMemo(() => {
        const ret = [];
        masterVideoList.forEach((item, index) => {
            if (index >= 5) return;
            ret.push({
                title: item.title,
                pic: item.pic,
                onClick: () => {
                    window.open('https://bilibili.com/video/' + item.bvid);
                }
            })
        })
        return ret;
    }, [masterVideoList])

    return loaded ? <Grid container spacing={2}>
        <Grid item xs={12} md={6} xl={8}>
            <VideoAlbumCarousel slides={slidesList} />
        </Grid>
        <Grid item xs={12} md={6} xl={4}>

        </Grid>
    </Grid> : null;
}
export default HomePage;