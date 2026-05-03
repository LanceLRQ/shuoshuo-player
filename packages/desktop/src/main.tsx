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

setPlatformBridge(createTauriPlatformBridge());

bootstrapPersistence()
  .catch((err) => {
    console.error('[shuoshuo-desktop] bootstrap 失败，使用空状态启动：', err);
  })
  .finally(() => {
    // Wbi 密钥仅在启动时拉一次（与 v1 player.js mount-once 行为一致）；
    // wbi key 每日更新，单次会话内无需周期刷新——多次 nav 反而可能触发 B 站风控
    void triggerWbiRefresh().catch(() => {
      /* noop */
    });

    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
