import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PlayerLayout } from '@/components/layout/player-layout';
import { SPlayer } from '@/components/player/s-player';
import { ToasterProvider } from '@/components/toaster-provider';
import { CloudLoginDialog } from '@/components/dialogs/cloud-login-dialog';
import { FavEditDialog } from '@/components/dialogs/fav-edit-dialog';
import { AddSongDialog } from '@/components/dialogs/add-song-dialog';
import { AddToFavDialog } from '@/components/dialogs/add-to-fav-dialog';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { RiskControlDialog } from '@/components/dialogs/risk-control-dialog';

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
const CloudSettingsPage = lazy(() =>
  import('@/pages/cloud-services/settings').then((m) => ({ default: m.CloudSettingsPage })),
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
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
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
      {
        path: 'cloud-services',
        element: <CloudServicesLayout />,
        children: [
          { index: true, element: <Navigate to="lyrics" replace /> },
          { path: 'lyrics', element: <LyricListPage /> },
          { path: 'live-slicer-men', element: <LiveSlicerMenPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'settings', element: <CloudSettingsPage /> },
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
  return (
    <>
      <RouterProvider router={router} />
      <ToasterProvider />
    </>
  );
}
