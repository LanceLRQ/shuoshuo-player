import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import '@fontsource/roboto/400.css';
import PlayerIndex from './player';
import store from '../store/index';
import API from '../api';

const testApi = async () => {
    const resp = await API.Bilibili.UserApi.getUserInfo();
    console.log(resp);
}
testApi().then();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <Provider store={store}>
        <PlayerIndex />
    </Provider>
);

