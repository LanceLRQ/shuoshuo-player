import PlayListReducerRoot from "@/store/play_list";
import CachesReducerRoot from "@/store/caches";
import ProfileReducerRoot from "@/store/profile";
export const createRootReducer = () => {
    return {
        play_list: PlayListReducerRoot,
        caches: CachesReducerRoot,
        profile: ProfileReducerRoot,
    };
};