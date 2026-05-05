import { useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useCloudServiceStore, useUIStore, NoticeType } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_ORDER = ['lyrics', 'live-slicer-men'] as const;
type CloudTab = (typeof TAB_ORDER)[number];

export function CloudServicesLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = useCloudServiceStore((s) => s.isLogin());
  const isAdmin = useCloudServiceStore((s) => s.isAdmin());
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openCloudLogin = useUIShell((s) => s.openCloudLogin);

  // 当前路径末段作为激活 Tab；fallback 'lyrics'
  const activeTab = useMemo<CloudTab>(() => {
    const seg = location.pathname.split('/').filter(Boolean).pop();
    return (TAB_ORDER as readonly string[]).includes(seg ?? '') ? (seg as CloudTab) : 'lyrics';
  }, [location.pathname]);

  // 未登录拦截：弹登录框 + 重定向回首页
  useEffect(() => {
    if (!isLogin) {
      openCloudLogin();
      sendNotice({
        type: NoticeType.WARN,
        message: '云服务功能需要先登录',
        duration: 3000,
      });
    }
  }, [isLogin, openCloudLogin, sendNotice]);

  if (!isLogin) {
    return <Navigate to="/index" replace />;
  }

  // 非管理员没有云服务管理页可看 → 直接跳全局设置（云服务 tab）
  if (!isAdmin) {
    return <Navigate to="/settings?tab=cloud" replace />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">云服务管理</h2>
        <p className="text-xs text-muted-foreground">管理员视图</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/cloud-services/${v}`)}>
        <TabsList>
          <TabsTrigger value="lyrics">歌词管理</TabsTrigger>
          <TabsTrigger value="live-slicer-men">切片 UP 主</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>
        <Outlet />
      </div>
    </div>
  );
}
