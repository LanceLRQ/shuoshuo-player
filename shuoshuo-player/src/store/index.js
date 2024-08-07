import { configureStore } from '@reduxjs/toolkit';
import { createRootReducer } from './reducers';

const preloadedState = {
    play_list: {},                  // 播放列表、歌单列表等
    // preference: {},                 // 用户偏好信息
    caches: {},                     // 缓存信息
};

const persistKeys = ['play_list', 'preference', 'caches']

const loadReducerState = () => {
    if (window.localStorage) {
        try {
            persistKeys.forEach((key) => {
                if (preloadedState[key]) {
                    preloadedState[key] = JSON.parse(window.localStorage.getItem(`shuoshuo-player:${key}`) || '{}');
                }
            })
        } catch (e) {}
    }
}

loadReducerState();

export const store = configureStore({
    reducer: createRootReducer(),
    preloadedState,
});

store.subscribe(() => {
    const storeState = store.getState();
    if (storeState && window.localStorage) {
        persistKeys.forEach((key) => {
            if (storeState[key]) {
                window.localStorage.setItem(`shuoshuo-player:${key}`, JSON.stringify(storeState[key]));
            }
        });
    }
});

if (process.env.NODE_ENV !== 'production' && module.hot) {
    module.hot.accept('./reducers', () => store.replaceReducer(createRootReducer()));
}

export default store;
