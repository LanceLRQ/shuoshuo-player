import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { PlayerLayout } from '@/components/layout/player-layout';
import { SPlayer } from '@/components/player/s-player';
import { ToasterProvider } from '@/components/toaster-provider';
import { CloudLoginDialog } from '@/components/dialogs/cloud-login-dialog';
import { FavEditDialog } from '@/components/dialogs/fav-edit-dialog';
import { AddSongDialog } from '@/components/dialogs/add-song-dialog';
import { AddToFavDialog } from '@/components/dialogs/add-to-fav-dialog';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { HomePage } from '@/pages/home';
import { LiveSlicersPage } from '@/pages/live-slicers';
import { FavListPage } from '@/pages/fav-list';
import { DiscoveryPage } from '@/pages/discovery';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <p>{title} 待后续批次实装</p>
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
        </>
      }
    >
      <Outlet />
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
        element: <PlaceholderPage title="云服务" />,
        children: [
          { index: true, element: <Navigate to="lyrics" replace /> },
          { path: 'lyrics', element: <PlaceholderPage title="歌词管理" /> },
          { path: 'live-slicer-men', element: <PlaceholderPage title="切片管理" /> },
          { path: 'accounts', element: <PlaceholderPage title="账户管理" /> },
          { path: 'settings', element: <PlaceholderPage title="服务设置" /> },
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
