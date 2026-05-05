import { lazy, Suspense, useEffect } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useBilibiliUserStore } from '@shuoshuo-player/shared';
import { PlayerLayout } from '@/components/layout/player-layout';
import { SPlayer } from '@/components/player/s-player';
import { LyricViewer } from '@/components/player/lyric-viewer';
import { ToasterProvider } from '@/components/toaster-provider';
import { BilibiliLoginRequired } from '@/components/bilibili-login-required';
import { CloudLoginDialog } from '@/components/dialogs/cloud-login-dialog';
import { FavEditDialog } from '@/components/dialogs/fav-edit-dialog';
import { AddSongDialog } from '@/components/dialogs/add-song-dialog';
import { AddToFavDialog } from '@/components/dialogs/add-to-fav-dialog';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { RiskControlDialog } from '@/components/dialogs/risk-control-dialog';
import { useUIShell } from '@/stores/ui-shell';

// 路由懒加载：每个页面单独 chunk（详见 vite.config manualChunks）
// .then 包装是因为页面采用命名导出（非 default），React.lazy 需要 { default } 形态
const HomePage = lazy(() => import('@/pages/home').then((m) => ({ default: m.HomePage })));
const FavListPage = lazy(() =>
  import('@/pages/fav-list').then((m) => ({ default: m.FavListPage })),
);
const DiscoveryPage = lazy(() =>
  import('@/pages/discovery').then((m) => ({ default: m.DiscoveryPage })),
);
const LiveSlicersPage = lazy(() =>
  import('@/pages/live-slicers').then((m) => ({ default: m.LiveSlicersPage })),
);
const CloudServicesLayout = lazy(() =>
  import('@/pages/cloud-services/layout').then((m) => ({ default: m.CloudServicesLayout })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsPage })),
);
const LyricListPage = lazy(() =>
  import('@/pages/cloud-services/lyric-list').then((m) => ({ default: m.LyricListPage })),
);
const LiveSlicerMenPage = lazy(() =>
  import('@/pages/cloud-services/live-slicer-men').then((m) => ({
    default: m.LiveSlicerMenPage,
  })),
);
const AccountsPage = lazy(() =>
  import('@/pages/cloud-services/accounts').then((m) => ({ default: m.AccountsPage })),
);

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function RootLayout() {
  // showLyric=true 时 main 区域被 LyricViewer 替换；NavMenu/TopBar/Footer 始终可见
  const showLyric = useUIShell((s) => s.showLyric);
  const closeLyric = useUIShell((s) => s.closeLyric);
  const location = useLocation();
  // 切换左侧栏路由时强制关闭歌词面板（编辑模式 local state 随 LyricViewer 卸载一并清空）
  // 直接 closeLyric 不做拦截：用户期望快速跳走；未保存改动的拦截只在主动点"返回"时触发
  useEffect(() => {
    closeLyric();
  }, [location.pathname, closeLyric]);
  return (
    <PlayerLayout
      footer={<SPlayer />}
      overlays={
        <>
          <CloudLoginDialog />
          <FavEditDialog />
          <AddSongDialog />
          <AddToFavDialog />
          <ConfirmDialog />
          <RiskControlDialog />
        </>
      }
    >
      {showLyric ? (
        <LyricViewer />
      ) : (
        <div className="h-full px-6 py-4">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      )}
    </PlayerLayout>
  );
}

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/index" replace /> },
      { path: 'index', element: <HomePage /> },
      { path: 'fav/:id', element: <FavListPage /> },
      { path: 'discovery', element: <DiscoveryPage /> },
      { path: 'live-slicers', element: <LiveSlicersPage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        path: 'cloud-services',
        element: <CloudServicesLayout />,
        children: [
          { index: true, element: <Navigate to="lyrics" replace /> },
          { path: 'lyrics', element: <LyricListPage /> },
          { path: 'live-slicer-men', element: <LiveSlicerMenPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          // 旧云服务设置子页 → 重定向到统一设置页（cloud tab）
          { path: 'settings', element: <Navigate to="/settings?tab=cloud" replace /> },
        ],
      },
      // v1 旧路径兼容重定向
      { path: 'live_slicers', element: <Navigate to="/live-slicers" replace /> },
      { path: 'cloud_services/*', element: <Navigate to="/cloud-services" replace /> },
      { path: '*', element: <Navigate to="/index" replace /> },
    ],
  },
]);

export default function App() {
  // 启动期由 init.ts 触发 triggerWbiRefresh → getLoginUserInfo，状态落地后 isInited=true
  // 三态短路：未 inited→spinner（与 v1 LoadingGif 行为一致，避免登录态闪烁）；
  //           已 inited 但未登录→引导卡片；已登录→主路由
  const isInited = useBilibiliUserStore((s) => s.isInited);
  const isLogin = useBilibiliUserStore((s) => s.isLogin);

  if (!isInited) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLogin) {
    return (
      <>
        <BilibiliLoginRequired />
        <ToasterProvider />
      </>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <ToasterProvider />
    </>
  );
}
