// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('ElectronAPI', {
    Store: {
        Set: (key, value) => ipcRenderer.send('store:set', key, value),
        Get: (key) => ipcRenderer.invoke('store:get', key),
    },
    Builtin: () => ipcRenderer.invoke('builtin:get'),
    Bilibili: {
        Login: () => ipcRenderer.invoke('bilibili:login'),
        LoginSuccess: (callback) => ipcRenderer.on('bilibili:login_success', (event) => callback(event))
    }
})