import PlayListReducerRoot from "@/store/play_list";
import CachesReducerRoot from "@/store/caches";
import ProfileReducerRoot from "@/store/profile";
import UIReducerRoot from "@/store/ui";

export const createRootReducer = () => {
    return {
        play_list: PlayListReducerRoot,
        caches: CachesReducerRoot,
        profile: ProfileReducerRoot,
        ui: UIReducerRoot,
    };
};