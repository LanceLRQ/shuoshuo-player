import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Palette, Cloud, HardDrive } from 'lucide-react';
import { detectPlatformType } from '@shuoshuo-player/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AppearanceSettings } from './appearance';
import { CloudSettings } from './cloud';
import { CacheSettings } from './cache';

type Tab = 'appearance' | 'cloud' | 'cache';
const VALID_TABS: Tab[] = ['appearance', 'cloud', 'cache'];

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
    () => (isTauri ? ['appearance', 'cloud', 'cache'] : ['appearance', 'cloud']),
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
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-muted-foreground">配置应用外观、云服务、本地缓存等。</p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
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
              云服务
            </TabsTrigger>
          )}
          {availableTabs.includes('cache') && (
            <TabsTrigger value="cache">
              <HardDrive className="mr-1.5 h-4 w-4" />
              缓存
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="appearance" className="mt-4">
          <AppearanceSettings />
        </TabsContent>
        <TabsContent value="cloud" className="mt-4">
          <CloudSettings />
        </TabsContent>
        {isTauri && (
          <TabsContent value="cache" className="mt-4">
            <CacheSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
