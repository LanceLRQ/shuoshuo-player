import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  bootstrapPersistence,
  setPlatformBridge,
  triggerWbiRefresh,
} from '@shuoshuo-player/shared';
import App from './App';
import { createTauriPlatformBridge } from '@desktop/lib/platform';
import '@/styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('未找到根节点 #root');
}

// WBI 密钥刷新间隔（30 分钟，与 v1 行为一致；Chrome 扩展端走 chrome.alarms）
const WBI_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

setPlatformBridge(createTauriPlatformBridge());

bootstrapPersistence()
  .catch((err) => {
    console.error('[shuoshuo-desktop] bootstrap 失败，使用空状态启动：', err);
  })
  .finally(() => {
    // 启动时立即同步一次 WBI 密钥；setInterval 仅负责后续 30 分钟周期刷新
    void triggerWbiRefresh().catch(() => {
      /* noop */
    });
    // 桌面端用前端 setInterval 触发 WBI 刷新（无 Service Worker / chrome.alarms）
    setInterval(() => {
      void triggerWbiRefresh();
    }, WBI_REFRESH_INTERVAL_MS);

    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
