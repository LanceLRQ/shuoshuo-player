import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { Provider } from 'react-redux';
import '@fontsource/roboto/400.css';
import PlayerIndex from './player';
import store from '../store/index';

dayjs.locale('zh-cn')
dayjs.extend(require('dayjs/plugin/relativeTime'))

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <Provider store={store}>
        <PlayerIndex />
    </Provider>
);

