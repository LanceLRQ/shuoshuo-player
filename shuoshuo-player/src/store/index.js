import { throttle } from 'lodash';
import { configureStore } from '@reduxjs/toolkit';
import { createRootReducer } from './reducers';
import isElectron from 'is-electron';

// const preloadedState = {
    // bili_current_user: {},
    // bili_user_videos: {},
    // bili_videos: {},
    // playing_list: {},
    // ui_notices: {},
// };
const inElectron = isElectron();

const persistKeys = ['bili_user_videos', 'bili_videos', 'playing_list', 'fav_list', 'ui_profile']
const persistFunc = {
    bili_user_videos: (state) => {
        return {
            ...state,
            isLoading: false,
        }
    }
}
const chromeStorage = chrome && chrome.storage && chrome.storage.local;

const readStateFromChromeStorage = () => new Promise((resolve, reject) => {
    try {
        const ret = {};
        const procData = (result) => {
            if (!result) {
                resolve({});
                return;
            }
            persistKeys.forEach((key) => {
                if (result[key]) {
                    ret[key] = result[key] || {};
                }
            })
            resolve(ret);
        }
        if (inElectron && window.ElectronAPI) {
            window.ElectronAPI.Store.Get('player_data').then((result) => {
                procData(result);
            });
        } else {
            chromeStorage.get(persistKeys, (result) => {
                procData(result);
            })
        }
    } catch (e) {
        reject(e);
    }
});

let preloadedState = {};
try {
    preloadedState = await readStateFromChromeStorage();
}catch (e){
    console.log(e);
}

export const store = configureStore({
    reducer: createRootReducer(),
    preloadedState,
});

const persistStore = throttle(() => {
    const storeState = store.getState();
    if (storeState) {
        const result = {};
        persistKeys.forEach((key) => {
            if (storeState[key]) {
                if (persistFunc[key]) {
                    result[key] = persistFunc[key](storeState[key]);
                } else {
                    result[key] = storeState[key];
                }
            }
        });
        if (process.env.NODE_ENV === 'development') {
            console.debug(storeState, 'saved');
        }
        if (inElectron && window.ElectronAPI) {
            window.ElectronAPI.Store.Set('player_data', result)
        } else if (chromeStorage) {
            chromeStorage.set(result, () => {});
        }
    }
}, 1000);

store.subscribe(() => {
    persistStore();
});

if (process.env.NODE_ENV !== 'production' && module.hot) {
    module.hot.accept('./reducers', () => store.replaceReducer(createRootReducer()));
}

export default store;
