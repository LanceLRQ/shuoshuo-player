import React from 'react';
import ReactJkMusicPlayer from "react-jinke-music-player";

export const CustomJkPlayer = () => {
    const audioLists = [
        // {
        //     name: 'Despacito',
        //     singer: 'Luis Fonsi',
        //     cover:
        //         'http://res.cloudinary.com/alick/image/upload/v1502689731/Despacito_uvolhp.jpg',
        //     musicSrc:
        //         'http://res.cloudinary.com/alick/video/upload/v1502689683/Luis_Fonsi_-_Despacito_ft._Daddy_Yankee_uyvqw9.mp3',
        //     // support async fetch music src. eg.
        //     // musicSrc: async () => {
        //     //   return await fetch('/api')
        //     // },
        // },
    ];

    return <ReactJkMusicPlayer
        mode="full"
        toggleMode={false}
        responsive={false}
        showMediaSession
        audioLists={audioLists}
    />
}
export default CustomJkPlayer;