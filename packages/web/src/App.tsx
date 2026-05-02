import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlayerLayout } from '@/components/layout/player-layout';
import { SPlayer } from '@/components/player/s-player';
import { ToasterProvider } from '@/components/toaster-provider';
import { CloudLoginDialog } from '@/components/dialogs/cloud-login-dialog';
import { FavEditDialog } from '@/components/dialogs/fav-edit-dialog';
import { AddSongDialog } from '@/components/dialogs/add-song-dialog';
import { AddToFavDialog } from '@/components/dialogs/add-to-fav-dialog';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <p>{title} 待 Phase 4 实装</p>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
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
        <Routes>
          <Route path="/" element={<Navigate to="/index" replace />} />
          <Route path="/index" element={<PlaceholderPage title="首页" />} />
          <Route path="/discovery" element={<PlaceholderPage title="搜索发现" />} />
          <Route path="/live-slicers" element={<PlaceholderPage title="直播切片" />} />
          <Route path="/live_slicers" element={<Navigate to="/live-slicers" replace />} />
          <Route path="/cloud-services/*" element={<PlaceholderPage title="云服务" />} />
          <Route path="/cloud_services/*" element={<Navigate to="/cloud-services/lyrics" replace />} />
          <Route path="/fav/:id" element={<PlaceholderPage title="收藏歌单" />} />
          <Route path="*" element={<Navigate to="/index" replace />} />
        </Routes>
      </PlayerLayout>
      <ToasterProvider />
    </HashRouter>
  );
}
