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
        playNext: false,
    },
    reducers: (create) => ({
        // 移除播放列表中的某个视频
        // 当mode为'fully'时，将移除整个播放列表
        // 当mode为其他值，将移除bv_id指定的视频，由audioKey指定
        syncPlaylistDelete:  create.reducer((state, action) => {
            const { mode, audioKey } = action.payload;
            if (mode === 'fully') {
                state.bv_ids = [];
                state.fav_id = '';
                state.current = '';
                state.playNext = true;
                return;
            }
            const aKeys = audioKey.split(',');
            const bvId = aKeys[0];
            state.bv_ids = state.bv_ids.filter(item => item !== bvId)
            // 如果当前视频正在播放，则移除。注意发送playNext指令，播放器会判断是否要停下
            if (state.current === bvId) {
                state.current = '';
                state.playNext = true;
            }
            if (!state.bv_ids.length) {
                state.fav_id = '';
                state.current = '';
                state.playNext = true;
            }
        }),
        addSingle: create.reducer((state, action) => {
            const { bvId, playNow = false } = action.payload;
            const extIdx = state.bv_ids.findIndex((item) => item === bvId);
            if (extIdx < 0) {
                state.bv_ids.push(bvId);
            }
            if (playNow) {
                state.current = bvId;
                state.playNext = true;   // 如果列表没有变化，发送一个playNext信号过去
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
                        state.current = bvId;
                        state.playNext = true;
                        // state.gotoIndex = bvIds.findIndex((item) => item === bvId) ?? 0;
                    }
                },
            }
        ),
        removePlayNext: create.reducer((state, action) => {
            state.playNext = false;
        }),
        updateCurrentPlaying: create.reducer((state, action) => {
            const { index, playNext } = action.payload;
            if (state.current !== state.bv_ids[index]) {
                state.current = state.bv_ids[index];
            }
            if (playNext) {
                state.playNext = true;
            }
        }),
    }),
    selectors: {
        current: (state) => ({
            current: state.current,
            current_key: `${state.current}:1`, // 后面的1是p1的意思，为后面如果要播分p的内容预留的
            index: state.bv_ids.findIndex((item) => item === state.current),
            favId: state.fav_id
        }),
        currentBvID: (state) => state.current,
        videoList: (state) => state.bv_ids,
        playNext: (state) => state.playNext,
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