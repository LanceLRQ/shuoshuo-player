import { useState } from 'react';
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Puzzle,
  FolderOpen,
  Trash2,
  ScrollText,
} from 'lucide-react';
import {
  useUpdateCheckerStore,
  getPlatformBridge,
  detectPlatformType,
  isNewerVersion,
  isValidVersion,
  NoticeType,
  useUIStore,
} from '@shuoshuo-player/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { APP_VERSION, IS_BETA_VERSION } from '@/lib/version';
import { useUIShell } from '@/stores/ui-shell';
import { V1DevSeederCard } from '@/components/migration/v1-dev-seeder-card';

const OFFICIAL_RELEASE_URL = 'https://shuoshuo.sikong.ren/player';
const GITHUB_URL = 'https://github.com/LanceLRQ/shuoshuo-player';
const RELEASES_URL = 'https://github.com/LanceLRQ/shuoshuo-player/releases';
const LICENSE_URL = 'https://github.com/LanceLRQ/shuoshuo-player/blob/main/LICENSE';
const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/%E8%AF%B4%E8%AF%B4%E6%92%AD%E6%94%BE%E5%99%A8-%E6%B0%B4%E6%99%B6%E8%9F%B9%E5%AE%9A%E5%88%B6%E7%89%88/odfgnejgeebbccohpgjdmbklaoicndpb';

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

  /* ===== 日志（仅 Tauri 端 LoggerAdapter 存在时显示）===== */
  // bridge 可能未注入（测试 / SSR），用 try-catch 保护；adapter 不存在时整块隐藏
  const loggerAdapter = (() => {
    try {
      return getPlatformBridge().logger;
    } catch {
      return undefined;
    }
  })();
  const openConfirm = useUIShell((s) => s.openConfirm);

  const handleOpenLogDir = async () => {
    if (!loggerAdapter?.openDir) return;
    const ok = await loggerAdapter.openDir();
    if (!ok) {
      sendNotice({
        type: NoticeType.ERROR,
        message: '打开日志目录失败',
        duration: 3000,
      });
    }
  };

  const handleClearLogs = () => {
    if (!loggerAdapter?.clear) return;
    openConfirm({
      title: '清空当日日志？',
      description: '将删除当日 .log 文件的全部内容（不影响历史 rotate 备份）。',
      confirmText: '清空',
      destructive: true,
      onConfirm: async () => {
        const ok = await loggerAdapter.clear!();
        sendNotice({
          type: ok ? NoticeType.SUCCESS : NoticeType.ERROR,
          message: ok ? '已清空当日日志' : '清空失败',
          duration: 2000,
        });
      },
    });
  };

  // Chrome 扩展走 Web Store 自动更新，应用内不需要做版本检查 UI
  // 直接给一个跳转商店的按钮，扩展内点击会打开商店页面
  const isChromeExtension = detectPlatformType() === 'chrome-extension';

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
      {/* 项目简介（引自 README） */}
      <Card>
        <CardHeader>
          <CardTitle>说说播放器</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>
            「说说播放器」是一款基于 Bilibili
            的第三方音乐播放器。此播放器为粉丝定制版本，可以将说宝或者其他 Up 主的 B
            站视频投稿变成你的歌单。
          </p>
        </CardContent>
      </Card>

      <Card>
        {/* Header 改为左右对齐：标题左、操作按钮右；移除副标题描述 */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>版本与更新</CardTitle>
          {isChromeExtension ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenExternal(OFFICIAL_RELEASE_URL)}
                aria-label="手动下载"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="ml-2">手动下载</span>
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenExternal(CHROME_STORE_URL)}
                aria-label="前往 Chrome 应用商店"
              >
                <Puzzle className="h-4 w-4" />
                <span className="ml-2">Chrome 应用商店</span>
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleCheck} disabled={isChecking} aria-label="立即检查更新">
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">立即检查</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 第一行：当前版本号 + Beta 徽章 */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight">v{APP_VERSION}</span>
            {IS_BETA_VERSION && <Badge variant="secondary">Beta</Badge>}
          </div>

          {/* Chrome 扩展走 Web Store 自动更新，不显示应用内检查相关信息 */}
          {!isChromeExtension && (
            <>
              {/* 第二行：上次检查（左）/ 已知最新版本（右），左右对齐紧凑展示 */}
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>
                  上次检查：
                  <span className="text-foreground">{formatTimestamp(lastCheckedAt)}</span>
                </p>
                {latestKnown && (
                  <p className="flex items-center gap-1.5">
                    已知最新版本：
                    <span className="text-foreground">{latestKnown.tag}</span>
                    {latestKnown.channel === 'beta' && (
                      <Badge variant="secondary" className="text-[10px]">
                        Beta
                      </Badge>
                    )}
                  </p>
                )}
              </div>

              {/* 第三行：有新版时高亮提示 + 操作 */}
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
            </>
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
            onClick={() => handleOpenExternal(OFFICIAL_RELEASE_URL)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            官方发布页
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </Button>
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
        </CardContent>
      </Card>

      {/* 日志（仅桌面端注入 LoggerAdapter；扩展端隐藏整块） */}
      {loggerAdapter && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              日志
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleOpenLogDir}>
                <FolderOpen className="mr-1.5 h-4 w-4" />
                打开目录
              </Button>
              <Button size="sm" variant="outline" onClick={handleClearLogs}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                清空当日日志
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 隐私安全声明（引自 README） */}
      <Card>
        <CardHeader>
          <CardTitle>隐私安全声明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            云服务功能只用于我们提供播放器的一些公共服务（如 UP 主投稿的自动显示歌词、切片 man
            信息展示）。
          </p>
          <p>
            为了保护用户隐私，
            <strong className="text-foreground">
              我们不会收集任何个人信息，所有 B 站登录信息、视频数据均存储在本地。
            </strong>
          </p>
          <p>
            播放器的<strong className="text-foreground">歌单、播放功能均是模拟用户访问 B 站</strong>
            ，我们也不会在云端收集任何 B 站的视频信息。
          </p>
          <p>
            播放器、云服务端均完全开源免费，仅供学习交流使用，
            <strong className="text-foreground">
              禁止将播放器用于任何商业用途，否则后果自负。
            </strong>
          </p>
        </CardContent>
      </Card>

      {/* 项目协议（MIT + 附加条款，引自 README） */}
      <Card>
        <CardHeader>
          <CardTitle>项目协议</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            本项目基于{' '}
            <a
              href={LICENSE_URL}
              className="text-foreground underline underline-offset-2"
              onClick={(e) => {
                e.preventDefault();
                handleOpenExternal(LICENSE_URL);
              }}
            >
              MIT License
            </a>{' '}
            许可证发行，以下协议是对于 MIT License 的补充，如有冲突，以以下协议为准。
          </p>
          <p>
            词语约定：本协议中的「本项目」指 <code>shuoshuo-player</code>
            项目；「使用者」指签署本协议的使用者；「官方音乐平台」指本项目内置的官方平台统称，包括哔哩哔哩动画（音源）、QQ
            音乐（歌词搜索来源）等；「版权数据」指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。
          </p>
          <p>
            本项目的数据来源原理是从各官方音乐平台的公开服务器中拉取数据，经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的准确性负责。
          </p>
          <p>
            使用本项目的过程中可能会产生版权数据，对于这些版权数据，本项目不拥有它们的所有权，
            <strong className="text-foreground">
              为了避免造成侵权，使用者务必在 24 小时内清除使用本项目的过程中所产生的版权数据。
            </strong>
          </p>
          <p>
            本项目内的官方音乐平台别名为本项目内对官方音乐平台的一个称呼，不包含恶意，如果官方音乐平台觉得不妥，可联系本项目更改或移除。本项目内使用的部分包括但不限于字体、图片等资源来源于互联网，如果出现侵权可联系本项目移除。
          </p>
          <p>
            由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。
          </p>
          <p>
            本项目完全免费，且开源发布于 GitHub
            面向全世界人用作对技术的学习交流，本项目不对项目内的技术可能存在违反当地法律法规的行为作保证，禁止在违反当地法律法规的情况下使用本项目，对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。
          </p>
          <p className="font-medium text-foreground">
            若你使用了本项目，将代表你接受以上协议。音乐视频平台不易，请尊重版权，支持正版。
          </p>
        </CardContent>
      </Card>

      {/* 开发者工具：v1 → v2 迁移测试（仅 dev:extension 构建可见，prod 构建 DCE） */}
      {__DEV_LOG__ && <V1DevSeederCard />}
    </div>
  );
}
