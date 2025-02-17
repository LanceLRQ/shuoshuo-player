const { app, BrowserWindow, session: ElectronSession, ipcMain, shell } = require('electron');
const path = require('path');
const url = require('path');
const ElectronStore = require('electron-store').default;

if (process.env.NODE_ENV !== 'production') {
  app.commandLine.appendSwitch("disable-gpu");
}

// 在此需要注册
const validStoreKey = ['player_data']
const PRODUCTION_FILE_PATH = `file://${require("path").resolve(__dirname,"..","renderer","build","index.html")}`
const PRODUCTION_PLAYER_PATH = `file://${require("path").resolve(__dirname,"..","renderer","build","player.html")}`
// 定义外部浏览器打开的链接
const externalUrlBase = ['https://bilibili.com/video/', 'https://space.bilibili.com']
const isExternalUrl = (url) => {
  return externalUrlBase.some(base => url.startsWith(base))
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const listenBilibiliCookies = (session) => {
  // 设置持久化cookie存储
  session.cookies.on('changed', (event, cookie, cause, removed) => {
    console.log('cookie changed', cookie, cause, removed);
    if (!removed) {
      // 将cookie设置为持久化
      cookie.session = false;
      session.cookies.set(cookie);
    }
  });

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
}

let mainWindow = null;
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true, // 使渲染进程拥有node环境
      webSecurity: false, //关闭web权限检查，允许跨域
    },
  });

  // 获取应用的session
  const session = mainWindow.webContents.session;

  listenBilibiliCookies(session)

  ipcMain.handle('bilibili:logout', async (event, key) => {
    // 清除所有cookie
    await session.clearStorageData({
      storages: ['cookies']
    });

    // 关闭主窗口并创建登录窗口
    mainWindow.close();
    createLoginWindow();
  })

  session.webRequest.onBeforeRequest({ urls: ['*://www.bilibili.com/*'], types: ['mainFrame']}, (details, callback) => {
    if (process.env.NODE_ENV === 'development') {
      // Dev模式走这个，仅做兼容
      callback({cancel: false, redirectURL: 'http://localhost:3000/player.html'});
    }
  })

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 允许特定域名的链接在Electron窗口中打开
    if (isExternalUrl(url)) {
      // 其他链接在系统浏览器中打开
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 处理a标签点击
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // 允许特定域名的导航
    if (isExternalUrl(url)) {
      // 阻止默认导航行为
      event.preventDefault();
      // 在系统浏览器中打开
      shell.openExternal(url);
      return;
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL("http://localhost:3000");
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    // and load the index.html of the app.
    mainWindow.loadURL(PRODUCTION_PLAYER_PATH);
    // mainWindow.webContents.openDevTools();
  }
};

const createLoginWindow = () => {
  // Create the browser window.
  const loginWindow = new BrowserWindow({
    width: 1000,
    height: 640,
    webPreferences: {
      webSecurity: false, //关闭web权限检查，允许跨域
    },
  });

  // 获取应用的session
  const session = loginWindow.webContents.session;

  listenBilibiliCookies(session)

  session.webRequest.onBeforeRequest({ urls: ['*://www.bilibili.com/*'], types: ['mainFrame']}, (details, callback) => {
    callback({cancel: true});
    loginWindow.close()
    if (mainWindow) {
      mainWindow.webContents.send('bilibili:login_success');
    }
  })
  loginWindow.loadURL("https://passport.bilibili.com/pc/passport/login");
}

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

  ipcMain.on('store:set', (event, key, value) => {
    if (!validStoreKey.includes(key)) return;
    store.set(key, value);
  })
  ipcMain.handle('store:get', async (event, key) => {
    if (!validStoreKey.includes(key)) return null;
    return store.get(key);
  })
  ipcMain.handle('builtin:get', async (event, key) => {
    return process.env.NODE_ENV === 'development' ? {
      IndexUrl: 'http://localhost:3000',
      PlayerUrl: 'http://localhost:3000/player.html',
    } : {
      IndexUrl: PRODUCTION_FILE_PATH,
      PlayerUrl: PRODUCTION_PLAYER_PATH,
    }
  })
  ipcMain.handle('bilibili:login', async (event, key) => {
    createLoginWindow();
  })

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
