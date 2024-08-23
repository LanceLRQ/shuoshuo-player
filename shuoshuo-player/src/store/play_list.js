import { nanoid } from 'nanoid';
import {createAppSlice} from "@/store/util";
import {FavListType, MasterUpInfo, NoticeTypes} from "@/constants";
import {MasterVideoListSelector} from "@/store/selectors/bilibili";
import {BilibiliUserVideoListSlice} from "@/store/bilibili";
import {PlayerNoticesSlice} from "@/store/ui";

export const PlayingListSlice = createAppSlice({
    name: 'playing_list',
    initialState: {
        // 这个reducer将用于生成播放器的播放列表
        // 如果点击播放歌单，则通过这个id判断，并替换掉所有bv_ids
        // 如果单个播放，默认是追加到bv_ids列表中
        fav_id: '',             // 当前播放的歌单ID
        bv_ids: [],             // 视频的id列表
        current: '',            // 当前播放的BVID
        currentIndex: 0,        // 当前播放的视频的index，用于播放器记忆
        gotoIndex: 0,
    },
    reducers: (create) => ({
        syncPlaylist:  create.reducer((state, action) => {
            const { audioList } = action.payload;
            const keysMap = {};
            audioList.forEach(item => {keysMap[item.key] = true});
            state.bv_ids = state.bv_ids.filter(item => keysMap[item])
        }),
        addSingle: create.reducer((state, action) => {
            const { bvId, playNow = false } = action.payload;
            const extIdx = state.bv_ids.findIndex((item) => item === bvId);
            const listLength = state.bv_ids.length;
            let isAdd = false;
            if (extIdx < 0) {
                state.bv_ids.push(bvId);
                isAdd = true;
            }
            if (playNow) {
                state.current = bvId;
                if (isAdd) {
                    state.gotoIndex = listLength;
                } else {
                    state.gotoIndex = extIdx;
                }
            }
        }),
        addFromFavList: create.asyncThunk(
            async (actionPayload, { getState }) => {
                const { favId, bvId, playNow } = actionPayload;
                let mid = 0, bvIds = [];
                if (favId === 'main') {
                    mid = MasterUpInfo.mid;
                } else {
                    const favList = FavListSlice.selectors.favList(getState());
                    const favItem = favList.find(item => item.id === favId);
                    if (!favItem) return null;
                    if (favItem.type === FavListType.UPLOADER) {
                        mid = favItem.mid;
                    } else {
                        bvIds = [...favItem.bv_ids];
                    }
                }
                if (mid > 0) {
                    const masterVideoListAll = MasterVideoListSelector(getState());
                    const masterVideoList = masterVideoListAll[mid];
                    bvIds = masterVideoList.map((item) => item.bvid);
                }
                return { favId, bvIds, bvId, playNow };
            },
            {
                fulfilled: (state, action) => {
                    if (!action.payload) return;
                    const { favId, bvIds, bvId, playNow } = action.payload;
                    state.fav_id = favId;
                    state.bv_ids = bvIds;
                    if (playNow) {
                        state.gotoIndex = bvIds.findIndex((item) => item === bvId) ?? 0;
                    }
                },
            }
        ),
        updateCurrentPlaying: create.reducer((state, action) => {
            const { index } = action.payload;
            state.currentIndex = index;
            if (state.currentIndex === state.gotoIndex) {
                state.gotoIndex = -1;
            }
        }),
    }),
    selectors: {
        current: (state) => ({ current: state.bv_ids[state.currentIndex], index: state.currentIndex, favId: state.fav_id }),
        gotoIndex: (state) => state.gotoIndex,
        videoList: (state) => state.bv_ids,
    }
});

export const FavListSlice = createAppSlice({
    name: 'fav_list',
    initialState: {
        list: [],
        // 歌单列表， {
        //  id: '',
        //  name: '‘,           // 歌单名称
        //  type: 0,            // 0 - 自定义列表, 1 - up主投稿列表
        //  mid: '',            // B站up主uid (type == 1时)
        //  bv_ids: [],         // 自定义BV列表 (type == 0时)
        //  create_time: 0,     // 列表创建时间
        // }
    },
    reducers: (create) => ({
        addFavList: create.asyncThunk(
            async (actionPayload) => {
                const { type = FavListType.CUSTOM, name = '新建歌单', mid } = actionPayload;
                if (type === FavListType.UPLOADER) {
                    if (!mid) return { status: false };
                    // 如果mid是主up的，或者是已存在，则跳过
                    if (mid === MasterUpInfo.mid) return { status: false };
                }
                return {
                    status: true,
                    data: {
                        id: nanoid(),
                        type,
                        name: name || '未命名歌单',
                        mid: mid ?? '',
                        bv_ids: [],
                        create_time: Date.now(),
                        update_time: 0,
                    }
                };
            },
            {
                fulfilled: (state, action) => {
                    if (action.payload?.status) {
                        state.list.push(action.payload.data);
                    }
                }
            }
        ),
        removeFavList: create.reducer((state, action) => {
            const { favId } = action.payload;
            const favItemIndex = state.list.findIndex(item => item.id === favId);
            if (favItemIndex > -1) {
                state.list.splice(favItemIndex, 1);
            }
        }),
        modFavList: create.reducer((state, action) => {
            const { favId, name } = action.payload;
            const favItemIndex = state.list.findIndex(item => item.id === favId);
            if (favItemIndex > -1) {
                state.list[favItemIndex].name = name;
            }
        }),
        addFavVideo: create.reducer((state, action) => {
            const { favId, bvId } = action.payload;
            const favItemIndex = state.list.findIndex(item => item.id === favId);
            if (favItemIndex < 0) return;
            const favItem = state.list[favItemIndex];
            if (favItem.type === FavListType.UPLOADER) return;
            if (favItem.bv_ids.findIndex(item => item === bvId) > -1) return;
            favItem.bv_ids.push(bvId);
            favItem.update_time = Date.now();
            state.list[favItemIndex] = favItem;
        }),
        removeFavVideo: create.reducer((state, action) => {
            const { favId, bvId } = action.payload;
            const favItemIndex = state.list.findIndex(item => item.id === favId);
            if (favItemIndex < 0) return;
            const favItem = state.list[favItemIndex];
            if (favItem.type === FavListType.UPLOADER) return;
            const idx = favItem.bv_ids.findIndex(item => item === bvId);
            if (idx  < 0) return;
            state.list[favItemIndex].bv_ids.splice(idx, 1);
        }),
        addFavVideoByBvids: create.asyncThunk(async (actionPayload, { getState, dispatch }) => {
            const { favId, bvIds } = actionPayload;
            let suc = 0, err = 0;
            for (let i = 0; i < bvIds.length; i++) {
                const bvId = bvIds[i];
                const rel = await dispatch(BilibiliUserVideoListSlice.actions.getVideoByBvid({
                    bvId, index: i + 1, count: bvIds.length,
                }))
                if (rel) {
                    dispatch(FavListSlice.actions.addFavVideo({ favId, bvId }));
                    suc++;
                } else {
                    err++
                }
            }
            dispatch(PlayerNoticesSlice.actions.sendNotice({
                type: NoticeTypes.SUCCESS,
                message: `添加完成(成功:${suc},失败:${err})`,
                duration: 3000,
            }));
        })
    }),
    selectors: {
        favList: (state) => state.list,
    }
});

export const PlaylistSlices = [
    FavListSlice,
    PlayingListSlice
]

export default PlaylistSlices;