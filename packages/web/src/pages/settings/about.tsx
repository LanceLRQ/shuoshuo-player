import { useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import {
  useUpdateCheckerStore,
  getPlatformBridge,
  isNewerVersion,
  isValidVersion,
  NoticeType,
  useUIStore,
} from '@shuoshuo-player/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { APP_VERSION, IS_BETA_VERSION } from '@/lib/version';

const GITHUB_URL = 'https://github.com/LanceLRQ/shuoshuo-player';
const RELEASES_URL = 'https://github.com/LanceLRQ/shuoshuo-player/releases';
const MIRROR_URL = 'https://download.hutao.wiki/shuoshuo-player/releases';

function formatTimestamp(iso: string | null): string {
  if (!iso) return '从未检查';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '从未检查';
  return new Date(t).toLocaleString();
}

export function AboutSettings() {
  const lastCheckedAt = useUpdateCheckerStore((s) => s.lastCheckedAt);
  const latestKnown = useUpdateCheckerStore((s) => s.latestKnown);
  const isChecking = useUpdateCheckerStore((s) => s.isChecking);
  const check = useUpdateCheckerStore((s) => s.check);
  const ignoreVersion = useUpdateCheckerStore((s) => s.ignoreVersion);
  const sendNotice = useUIStore((s) => s.sendNotice);

  const [hasManualChecked, setHasManualChecked] = useState(false);

  const hasUpdate =
    latestKnown &&
    isValidVersion(latestKnown.version) &&
    isValidVersion(APP_VERSION) &&
    isNewerVersion(latestKnown.version, APP_VERSION);

  const handleCheck = async () => {
    setHasManualChecked(true);
    const r = await check({ force: true });
    if (!r) {
      sendNotice({
        type: NoticeType.ERROR,
        message: '检查更新失败，请稍后重试',
        duration: 3000,
      });
      return;
    }
    if (!isValidVersion(r.version) || !isNewerVersion(r.version, APP_VERSION)) {
      sendNotice({
        type: NoticeType.SUCCESS,
        message: '已是最新版本',
        duration: 2000,
      });
    }
  };

  const handleViewUpdate = () => {
    if (!latestKnown) return;
    void getPlatformBridge().shell.openExternal(latestKnown.release_url);
    ignoreVersion(latestKnown.version);
  };

  const handleIgnore = () => {
    if (!latestKnown) return;
    ignoreVersion(latestKnown.version);
    sendNotice({
      type: NoticeType.INFO,
      message: `已忽略 ${latestKnown.tag}，下次有更高版本时仍会提醒`,
      duration: 2000,
    });
  };

  const handleOpenExternal = (url: string) => {
    void getPlatformBridge().shell.openExternal(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>当前版本</CardTitle>
          <CardDescription>说说播放器版本信息与发布通道</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight">v{APP_VERSION}</span>
            {IS_BETA_VERSION && <Badge variant="secondary">Beta</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {IS_BETA_VERSION ? '当前处于 Beta 通道（1.x 区间），2.0 之后切换为稳定版' : '稳定版本'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>检查更新</CardTitle>
          <CardDescription>应用启动后会在 6 小时内自动检查一次；可在此立即触发</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                上次检查：<span className="text-foreground">{formatTimestamp(lastCheckedAt)}</span>
              </p>
              {latestKnown && (
                <p className="text-muted-foreground">
                  已知最新版本：
                  <span className="text-foreground">{latestKnown.tag}</span>
                  {latestKnown.channel === 'beta' ? (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      Beta
                    </Badge>
                  ) : null}
                </p>
              )}
            </div>
            <Button size="sm" onClick={handleCheck} disabled={isChecking} aria-label="立即检查更新">
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">立即检查</span>
            </Button>
          </div>

          {hasUpdate ? (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
              <div className="text-sm">
                发现新版本 <span className="font-semibold">{latestKnown.tag}</span>
                ，建议升级
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleIgnore}>
                  忽略此版本
                </Button>
                <Button size="sm" onClick={handleViewUpdate}>
                  查看详情
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            hasManualChecked &&
            !isChecking && (
              <p className="rounded-md border border-dashed py-3 text-center text-sm text-muted-foreground">
                你已经是最新版本
              </p>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>项目链接</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleOpenExternal(GITHUB_URL)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            GitHub 主页
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleOpenExternal(RELEASES_URL)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            GitHub Releases
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleOpenExternal(MIRROR_URL)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            国内镜像（Cloudflare CDN）
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
