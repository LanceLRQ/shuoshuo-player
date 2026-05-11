import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCloudServiceStore } from '@shuoshuo-player/shared';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_ORDER = ['index', 'lyrics', 'live-slicer-men'] as const;
type CloudTab = (typeof TAB_ORDER)[number];

export function CloudServicesLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  // Tabs 仅对管理员可见；其他人通过着陆页内的快捷入口或子页面 RequireCloudAdmin 提示卡跳转
  const isAdmin = useCloudServiceStore((s) => s.isAdmin());

  // 当前路径末段决定激活 Tab；模块根路径 /cloud-services 视为 'index'
  const activeTab = useMemo<CloudTab>(() => {
    const segs = location.pathname.split('/').filter(Boolean);
    if (segs.length <= 1) return 'index';
    const last = segs[segs.length - 1];
    return (TAB_ORDER as readonly string[]).includes(last) ? (last as CloudTab) : 'index';
  }, [location.pathname]);

  const handleTabChange = (v: string) => {
    if (v === 'index') {
      navigate('/cloud-services');
    } else {
      navigate(`/cloud-services/${v}`);
    }
  };

  // h-full + flex-col：让 Tab 固定顶部，Outlet 子内容自己撑满剩余高度独立滚动
  // min-h-0 必须有，否则 flex 子项默认按内容撑高，Outlet 子页就无法在受限高度内滚动
  return (
    <div className="flex h-full flex-col gap-4">
      {isAdmin && (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-none">
          <TabsList>
            <TabsTrigger value="index">首页</TabsTrigger>
            <TabsTrigger value="lyrics">歌词管理</TabsTrigger>
            <TabsTrigger value="live-slicer-men">切片 UP 主</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
