import { useEffect, useState } from 'react';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  useCloudServiceStore,
  useUIStore,
  detectPlatformType,
  DEFAULT_CLOUD_API_BASE_URL,
  NoticeType,
} from '@shuoshuo-player/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function CloudSettingsPage() {
  const apiBaseUrl = useCloudServiceStore((s) => s.apiBaseUrl);
  const setApiBaseUrl = useCloudServiceStore((s) => s.setApiBaseUrl);
  const resetApiBaseUrl = useCloudServiceStore((s) => s.resetApiBaseUrl);
  const sendNotice = useUIStore((s) => s.sendNotice);

  const [draft, setDraft] = useState(apiBaseUrl);

  // store 变化时同步本地 draft（如其他页面调用了 reset）
  useEffect(() => {
    setDraft(apiBaseUrl);
  }, [apiBaseUrl]);

  const platform = detectPlatformType();
  const isTauri = platform === 'tauri';

  const handleSave = () => {
    setApiBaseUrl(draft);
    sendNotice({
      type: NoticeType.SUCCESS,
      message: draft.trim()
        ? '云服务地址已更新'
        : '已恢复默认地址',
      duration: 2000,
    });
  };

  const handleReset = () => {
    resetApiBaseUrl();
    setDraft('');
    sendNotice({
      type: NoticeType.SUCCESS,
      message: '已恢复默认云服务地址',
      duration: 2000,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>云服务 API 地址</CardTitle>
        <CardDescription>
          自定义云服务后端地址。修改后立即生效，并在重启后保留。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">默认地址</Label>
          <code className="block break-all rounded bg-muted px-3 py-2 text-xs">
            {DEFAULT_CLOUD_API_BASE_URL}
          </code>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cloud-base-url">自定义地址</Label>
          <Input
            id="cloud-base-url"
            placeholder={DEFAULT_CLOUD_API_BASE_URL}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isTauri}
          />
          <p className="text-xs text-muted-foreground">
            留空时使用默认地址。
          </p>
        </div>

        {isTauri && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              桌面端暂不支持自定义地址；自 v2.x 起将通过 Rust 代理实现。
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button onClick={handleSave} disabled={isTauri || draft === apiBaseUrl}>
          <Save className="mr-1 h-4 w-4" />
          保存
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isTauri || (!apiBaseUrl && !draft)}
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          恢复默认
        </Button>
      </CardFooter>
    </Card>
  );
}
