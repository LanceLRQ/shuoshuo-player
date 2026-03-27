import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import isElectron from 'is-electron';
import ElectronApp from './electron';

function initPage() {
    const inElectron = isElectron();
    const root = ReactDOM.createRoot(document.getElementById('root'));
    if (inElectron) {
        root.render(<ElectronApp></ElectronApp>)
        return;
    }
    root.render(
        <div>
            播放器转到：<a href="/player.html">player.html</a>
        </div>
    );
}

initPage();
