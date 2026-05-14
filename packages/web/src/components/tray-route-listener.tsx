import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlatformBridge } from '@shuoshuo-player/shared';

/**
 * 监听 Tauri 托盘"设置…"菜单事件，跳到桌面端设置 tab。
 *
 * 为什么不直接在 tray-sync.ts 处理路由？
 * - tray-sync 在 main.tsx 启动时挂载，**不在 React 路由上下文里**，
 *   无法调用 useNavigate。本组件挂在 RootLayout overlays（路由树内），
 *   持有 React Router 实例后再订阅事件即可。
 *
 * 跨平台抽象：通过 `getPlatformBridge().trayEvents` 走 PlatformBridge，
 * 不直接 import @tauri-apps/api/event——web 包内不持有 Tauri 依赖。
 * 非 Tauri 平台 bridge.trayEvents 为 undefined，effect 直接 return。
 */
export function TrayRouteListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const trayEvents = getPlatformBridge().trayEvents;
    if (!trayEvents) return;
    return trayEvents.onOpenSettings(() => {
      navigate('/settings?tab=desktop');
    });
  }, [navigate]);

  return null;
}
