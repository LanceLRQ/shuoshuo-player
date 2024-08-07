import PlayListReducerRoot from "@/store/play_list";
import CachesReducerRoot from "@/store/caches";
export const createRootReducer = () => {
    return {
        play_list: PlayListReducerRoot,
        caches: CachesReducerRoot,
    };
};