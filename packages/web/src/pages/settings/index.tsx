import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Palette, Cloud, HardDrive, Info } from 'lucide-react';
import { detectPlatformType } from '@shuoshuo-player/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AppearanceSettings } from './appearance';
import { CloudSettings } from './cloud';
import { CacheSettings } from './cache';
import { AboutSettings } from './about';

type Tab = 'appearance' | 'cloud' | 'cache' | 'about';
const VALID_TABS: Tab[] = ['appearance', 'cloud', 'cache', 'about'];

/**
 * 统一设置页：tab 通过 URL ?tab= 同步，便于左侧导航和外链直达。
 * 缓存 tab 仅 Tauri 桌面端可见（detectPlatformType 判断）。
 */
export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const platform = detectPlatformType();
  const isTauri = platform === 'tauri';

  const availableTabs = useMemo<Tab[]>(
    () => (isTauri ? ['appearance', 'cloud', 'cache', 'about'] : ['appearance', 'cloud', 'about']),
    [isTauri],
  );

  const rawTab = params.get('tab');
  const tab: Tab = (VALID_TABS as string[]).includes(rawTab ?? '') ? (rawTab as Tab) : 'appearance';

  // 非 Tauri 用户访问 ?tab=cache → 重定向回 appearance
  useEffect(() => {
    if (tab === 'cache' && !isTauri) {
      navigate('/settings?tab=appearance', { replace: true });
    }
  }, [tab, isTauri, navigate]);

  const handleTabChange = (value: string) => {
    setParams({ tab: value }, { replace: true });
  };

  return (
    // 用 -mx-6 -my-4 反向抵消 RootLayout 的 px-6 py-4 包装，让设置页跨满 main；
    // h-[calc(100%+2rem)] 补偿 -my-4 抵消后的高度。
    <Tabs
      value={tab}
      onValueChange={handleTabChange}
      className="-mx-6 -my-4 flex h-[calc(100%+2rem)] flex-col"
    >
      {/* 头部跨整宽，border-t 接 TopBar 视觉延续；TabsList 在 max-w 居中容器内左对齐 */}
      <div className="flex-none border-t">
        <div className="mx-auto max-w-3xl px-6 py-3">
          <TabsList>
            {availableTabs.includes('appearance') && (
              <TabsTrigger value="appearance">
                <Palette className="mr-1.5 h-4 w-4" />
                外观
              </TabsTrigger>
            )}
            {availableTabs.includes('cloud') && (
              <TabsTrigger value="cloud">
                <Cloud className="mr-1.5 h-4 w-4" />
                水晶蟹小屋
              </TabsTrigger>
            )}
            {availableTabs.includes('cache') && (
              <TabsTrigger value="cache">
                <HardDrive className="mr-1.5 h-4 w-4" />
                缓存
              </TabsTrigger>
            )}
            {availableTabs.includes('about') && (
              <TabsTrigger value="about">
                <Info className="mr-1.5 h-4 w-4" />
                关于
              </TabsTrigger>
            )}
          </TabsList>
        </div>
      </div>

      {/* min-h-0 让 flex 子级允许收缩出现 overflow */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>
          <TabsContent value="cloud">
            <CloudSettings />
          </TabsContent>
          {isTauri && (
            <TabsContent value="cache">
              <CacheSettings />
            </TabsContent>
          )}
          <TabsContent value="about">
            <AboutSettings />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
