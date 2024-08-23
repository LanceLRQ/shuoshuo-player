import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { Provider } from 'react-redux';
import '@fontsource/roboto/400.css';
import PlayerIndex from './player';
import store from '../store/index';
import NoticesBox from './components/notices';
import {createHashRouter, createRoutesFromElements, Navigate, Route, RouterProvider} from "react-router-dom";
import Pages from "@player/pages";

dayjs.locale('zh-cn')
dayjs.extend(require('dayjs/plugin/relativeTime'))

const router = createHashRouter(
    createRoutesFromElements(
        <Route path="/" element={<PlayerIndex />}>
            <Route path="/index" element={<Pages.HomePage />}></Route>
            <Route path="/fav/:id" element={<Pages.FavListPage />}></Route>
            <Route path="/discovery" element={<Pages.DiscoveryPage />}></Route>
            <Route index element={<Navigate to="/index" replace />} />
        </Route>
    )
);


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <Provider store={store}>
        <RouterProvider router={router} />
        <NoticesBox />
    </Provider>
);

