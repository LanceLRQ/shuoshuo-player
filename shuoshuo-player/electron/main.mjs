import { app, BrowserWindow, session as ElectronSession, ipcMain } from 'electron';
import ElectronStore from 'electron-store';
import url  from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));



if (process.env.NODE_ENV !== 'production') {
  app.commandLine.appendSwitch("disable-gpu");
}

// 在此需要注册
const validStoreKey = ['player_data']

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

const createWindow = (store) => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, './preload.mjs'),
      nodeIntegration: true, // 使渲染进程拥有node环境
      webSecurity: false, //关闭web权限检查，允许跨域
    },
  });

  ipcMain.on('store:set', (event, key, value) => {
    if (!validStoreKey.includes(key)) return;
    store.set(key, value);
  })
  ipcMain.handle('store:get', async (event, key) => {
    if (!validStoreKey.includes(key)) return null;
    return store.get(key);
  })

  // 获取应用的session
  const session = mainWindow.webContents.session;

  // 为session设置webRequest事件监听
  session.webRequest.onBeforeSendHeaders( { urls: [
    '*://*.bilibili.com/*',
    "*://*.acgvideo.com/*",
    "*://*.bilivideo.com/*",
    "*://*.bilibili.com/*",
    "*://*.hdslb.com/*",
    "*://*.cgvideo.com/*",
    "*://*.bilivideo.cn/*",
    "*://*.akamaized.net/*"
  ] },(details, callback) => {
    ElectronSession.defaultSession.cookies.get({ url: details.url }).then(cookies => {
      details.requestHeaders['Referer'] = 'https://www.bilibili.com';
      details.requestHeaders['Cookie'] =  cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    })
  });

  session.webRequest.onBeforeRequest({ urls: ['*://www.bilibili.com/*'], types: ['mainFrame']}, (details, callback) => {
    callback({ cancel: false, redirectURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000/player.html' : path.join(__dirname, '../build/player.html') });
  })

  console.log(process.env.NODE_ENV)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL("http://localhost:3000");
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, '../build/index.html'),
      protocol: 'file',
      slashes: true
    }));
    mainWindow.webContents.openDevTools();
  }

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const store = new ElectronStore({
    scheme: {
      player_data: {
        type: 'object',
      }
    },
    serialize: value => JSON.stringify(value, null, '  ')
  });

  createWindow(store);

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(store);
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
