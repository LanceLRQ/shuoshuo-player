import { configureStore } from '@reduxjs/toolkit';
import { createRootReducer } from './reducers';

const preloadedState = {
    bili_current_user: {},
    bili_user_videos: {},
    bili_videos: {},
    playing_list: {},
    ui_notices: {},
};

const persistKeys = ['play_list', 'profile', 'bilibili']
const chromeStorage = chrome && chrome.storage && chrome.storage.local;

const readStateFromChromeStorage = () => new Promise((resolve, reject) => {
    try {
        chromeStorage.get(persistKeys, (result) => {
            persistKeys.forEach((key) => {
                if (result[key] && preloadedState[key]) {
                    preloadedState[key] = result[key] || {};
                }
            })
            resolve();
        })
    } catch (e) {
        reject();
    }
});

await readStateFromChromeStorage();

export const store = configureStore({
    reducer: createRootReducer(),
    preloadedState,
});

store.subscribe(() => {
    const storeState = store.getState();
    if (storeState && chromeStorage) {
        const result = {};
        persistKeys.forEach((key) => {
            if (storeState[key]) {
                result[key] = storeState[key];
            }
        });
        if (process.env.NODE_ENV === 'development') {
            console.log(storeState, 'saved');
        }
        chromeStorage.set(result, () => {});
    }
});

if (process.env.NODE_ENV !== 'production' && module.hot) {
    module.hot.accept('./reducers', () => store.replaceReducer(createRootReducer()));
}

export default store;
