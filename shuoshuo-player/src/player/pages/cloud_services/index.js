import React from "react";
import {Navigate, Outlet, Route, useMatches, useNavigate} from "react-router-dom";
import {Box, Tabs, Tab} from "@mui/material";
import {LyricListPage} from "@player/pages/cloud_services/lyric_list";
import lodash from 'lodash';

const IndexFrame = () => {
    const matches = useMatches();
    const tabKey = lodash.get(matches, `${matches.length - 1}.params.*`, "lyric")

    const navigate = useNavigate();
    const handleChange = (event, newValue) => {
        navigate(`/cloud_services/${newValue}`);
    };

    const tabs = [
        {label: '歌词管理', key: 'lyric'},
        {label: '账号管理', key: 'accounts'},
    ]

    return <Box>
        <Tabs
            value={tabKey}
            onChange={handleChange}
        >
            {tabs.map(item => {
                return <Tab key={item.key} value={item.key} label={item.label} />
            })}
        </Tabs>
        <Outlet />
    </Box>
}

const cloudServicesIndexPage = () => {
    return <Route path="/cloud_services/*" element={<IndexFrame />}>
        <Route path="lyric" element={<LyricListPage />} />
        <Route index element={<Navigate to="/cloud_services/lyric" />} />
    </Route>;
}

export default cloudServicesIndexPage;