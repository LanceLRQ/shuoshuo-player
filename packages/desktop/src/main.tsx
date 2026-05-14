import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  bootstrapPersistence,
  setBilibiliHttpAdapter,
  setCloudHttpAdapter,
  setPlatformBridge,
  triggerWbiRefresh,
  useBilibiliUserStore,
} from '@shuoshuo-player/shared';
import App from './App';
import { createTauriPlatformBridge } from '@desktop/lib/platform';
import {
  createTauriBilibiliHttpAdapter,
  createTauriCloudHttpAdapter,
} from '@desktop/lib/tauri-bilibili-http-adapter';
import { startWindowThemeSync } from '@desktop/lib/window-theme-sync';
import { startCloseActionSync } from '@desktop/lib/close-action-sync';
import { startTraySync } from '@desktop/lib/tray-sync';
import '@/styles/globals.css';

// 启动期 nav 接口若长时间未响应（极端网络场景），UI 不应永久卡在 spinner；
// 5 秒超时仍未 inited 则强制置位让引导卡片可见（CORS 路径已由 Tauri adapter 解决）
const INIT_FALLBACK_TIMEOUT_MS = 5000;

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('未找到根节点 #root');
}

// 注入 Tauri axios adapter：底层走 plugin-http（Rust reqwest）绕开 WebView CORS。
// 必须早于任何 API 请求执行（bootstrap 后 triggerWbiRefresh 即调 nav）。
// - bilibili adapter：注入 Cookie/Referer/Origin/UA 满足 B 站反爬
// - cloud adapter：纯透传（云服务后端未配 Allow-Origin，但不需要 bilibili headers）
setBilibiliHttpAdapter(createTauriBilibiliHttpAdapter());
setCloudHttpAdapter(createTauriCloudHttpAdapter());

setPlatformBridge(createTauriPlatformBridge());

bootstrapPersistence()
  .catch((err) => {
    console.error('[shuoshuo-desktop] bootstrap 失败，使用空状态启动：', err);
  })
  .finally(() => {
    // 应用主题 → 原生窗口外观同步（必须在 bootstrapPersistence 之后，
    // 才能读到持久化后的 theme 值；订阅延后注册避免启动期重复触发）
    startWindowThemeSync();

    // 关闭行为（隐藏到托盘 / 退出应用）同步到 Rust state；
    // 同步发生在 bootstrap 之后，避免拿到默认值覆盖持久化的用户选择
    startCloseActionSync();

    // 托盘菜单同步：当前曲目标签 / 播放暂停状态推送 + listen 菜单点击事件
    startTraySync();

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
