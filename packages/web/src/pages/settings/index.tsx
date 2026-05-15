import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Palette, Info, MonitorCog, Play } from 'lucide-react';
import { detectPlatformType } from '@shuoshuo-player/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AppearanceSettings } from './appearance';
import { PlaybackSettings } from './playback';
import { DesktopSettings } from './desktop';
import { AboutSettings } from './about';

type Tab = 'appearance' | 'playback' | 'desktop' | 'about';
const VALID_TABS: Tab[] = ['appearance', 'playback', 'desktop', 'about'];

/**
 * 统一设置页：tab 通过 URL ?tab= 同步，便于左侧导航和外链直达。
 * 桌面端 tab 仅 Tauri 平台可见，下辖关闭行为 / 音频缓存 / 首次引导三个分组。
 *
 * URL 兼容（透明重定向，避免老外链 / 书签 404）：
 * - 旧 ?tab=cache（v2 早期）→ ?tab=desktop
 * - 旧 ?tab=cloud（水晶蟹小屋曾是独立 tab）→ ?tab=about（已合并到关于页日志上方）
 */
export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const platform = detectPlatformType();
  const isTauri = platform === 'tauri';

  const availableTabs = useMemo<Tab[]>(
    () =>
      isTauri
        ? ['appearance', 'playback', 'desktop', 'about']
        : ['appearance', 'playback', 'about'],
    [isTauri],
  );

  const rawTab = params.get('tab');
  // 老 tab key 收敛：cache → desktop（音频缓存归属桌面端模块）；cloud → about（水晶蟹小屋归属关于页）
  const normalizedTab = rawTab === 'cache' ? 'desktop' : rawTab === 'cloud' ? 'about' : rawTab;
  const tab: Tab = (VALID_TABS as string[]).includes(normalizedTab ?? '')
    ? (normalizedTab as Tab)
    : 'appearance';

  useEffect(() => {
    // 老 cache 链接：Tauri 平台改写为 desktop；非 Tauri 平台回退到 appearance
    if (rawTab === 'cache') {
      navigate(isTauri ? '/settings?tab=desktop' : '/settings?tab=appearance', { replace: true });
      return;
    }
    // 老 cloud 链接：直接重定向到关于页（CloudSettings 已合并到 about）
    if (rawTab === 'cloud') {
      navigate('/settings?tab=about', { replace: true });
      return;
    }
    // 非 Tauri 用户访问 ?tab=desktop → 重定向回 appearance
    if (tab === 'desktop' && !isTauri) {
      navigate('/settings?tab=appearance', { replace: true });
    }
  }, [rawTab, tab, isTauri, navigate]);

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
            {availableTabs.includes('playback') && (
              <TabsTrigger value="playback">
                <Play className="mr-1.5 h-4 w-4" />
                播放
              </TabsTrigger>
            )}
            {availableTabs.includes('desktop') && (
              <TabsTrigger value="desktop">
                <MonitorCog className="mr-1.5 h-4 w-4" />
                桌面端
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
          <TabsContent value="playback">
            <PlaybackSettings />
          </TabsContent>
          {isTauri && (
            <TabsContent value="desktop">
              <DesktopSettings />
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
