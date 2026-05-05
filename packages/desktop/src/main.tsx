import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  bootstrapPersistence,
  setPlatformBridge,
  triggerWbiRefresh,
  useBilibiliUserStore,
} from '@shuoshuo-player/shared';
import App from './App';
import { createTauriPlatformBridge } from '@desktop/lib/platform';
import '@/styles/globals.css';

// Tauri WebView 直连 api.bilibili.com 可能因 CORS preflight hang（未走
// @tauri-apps/plugin-http），导致 getLoginUserInfo 长时间不返回、isInited
// 永远 false、UI 卡在 spinner。给 5 秒超时兜底：到点仍未 inited 则强制置位，
// UI 切到引导卡片让用户能操作；后续 nav 真返回成功仍会再次 setState 覆盖。
const INIT_FALLBACK_TIMEOUT_MS = 5000;

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

    setTimeout(() => {
      if (!useBilibiliUserStore.getState().isInited) {
        useBilibiliUserStore.setState({ isInited: true });
      }
    }, INIT_FALLBACK_TIMEOUT_MS);

    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
