import React, { useEffect } from "react";
import API from '../api'
import LoadingGif from "@/images/loading.webp";

function App() {

    useEffect(() => {
        API.Bilibili.UserApi.getUserInfo({}).then(res => {
            window.location.href = 'http://localhost:3000/player.html';
        }).catch(e => {
            if (!e.isLogin) {
                window.location.href = 'https://passport.bilibili.com/pc/passport/login?goto=https%3A%2F%2Fwww.bilibili.com';
            }
        })
    }, [])

    return <div style={{textAlign: 'center', marginTop: 100}}>
        <img alt="loading" src={LoadingGif} width={64} height={64}/>
        <br />
        正在检测B站登录情况
    </div>
}

export default App