import { useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  useCloudServiceStore,
  useUIStore,
  NoticeType,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_ORDER = ['lyrics', 'live-slicer-men', 'accounts', 'settings'] as const;
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
    return (TAB_ORDER as readonly string[]).includes(seg ?? '')
      ? (seg as CloudTab)
      : 'lyrics';
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

  // 非管理员仅可见 settings；如尝试访问其它子页则重定向到 settings
  if (!isAdmin && activeTab !== 'settings') {
    return <Navigate to="/cloud-services/settings" replace />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">云服务管理</h2>
        <p className="text-xs text-muted-foreground">
          {isAdmin ? '管理员视图' : '普通用户视图'}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => navigate(`/cloud-services/${v}`)}
      >
        <TabsList>
          {isAdmin && <TabsTrigger value="lyrics">歌词管理</TabsTrigger>}
          {isAdmin && <TabsTrigger value="live-slicer-men">切片管理</TabsTrigger>}
          {isAdmin && <TabsTrigger value="accounts">账户管理</TabsTrigger>}
          <TabsTrigger value="settings">服务设置</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>
        <Outlet />
      </div>
    </div>
  );
}
