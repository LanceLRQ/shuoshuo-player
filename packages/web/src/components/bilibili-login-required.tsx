import { useEffect, type MouseEvent } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { MASTER_UP_INFO, getPlatformBridge } from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import logoUrl from '@/assets/logo.png';

/**
 * B 站未登录引导卡片
 *
 * 渲染时机：App 根级守卫检测到 useBilibiliUserStore.isInited && !isLogin。
 *
 * 行为对齐 v1（v1/shuoshuo-player/src/player/player.js:91-115）：
 * - 「去B站」按钮通过 PlatformBridge.auth.login() 触发平台对应的登录入口
 *   （Tauri 走 Rust invoke 开 1000×640 登录窗；Web/扩展走 window.open passport）
 * - mount 时订阅 bilibili:login_success 事件，登录成功后整页 reload
 *   （reload 会让 init 序列重跑 triggerWbiRefresh → getLoginUserInfo，状态恢复最稳）
 * - UP 主主页链接走 shell.openExternal，避免 Tauri 内嵌 WebView 加载外站
 */
export function BilibiliLoginRequired() {
  useEffect(() => {
    const unsubscribe = getPlatformBridge().auth.onLoginSuccess(() => {
      window.location.reload();
    });
    return unsubscribe;
  }, []);

  const handleOpenUpHome = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void getPlatformBridge().shell.openExternal(`https://space.bilibili.com/${MASTER_UP_INFO.mid}`);
  };

  const handleLogin = () => {
    void getPlatformBridge().auth.login();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <img src={logoUrl} alt="说说播放器" className="h-12 w-12 rounded-full object-cover" />
          <CardTitle>说说播放器</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">
            由于需要拉取
            <a
              href={`https://space.bilibili.com/${MASTER_UP_INFO.mid}`}
              onClick={handleOpenUpHome}
              className="mx-1 text-primary underline-offset-2 hover:underline"
            >
              @{MASTER_UP_INFO.uname}
            </a>
            的投稿列表需要登录B站，请先前往B站登录自己的账号，然后刷新本页面。
          </p>
          <p className="text-sm font-semibold leading-relaxed">
            所有B站的数据的访问均由浏览器代为完成，播放器仅是模拟访问B站公开的数据接口，缓存均在本地完成，不会访问您的登录信息，请放心。
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={handleLogin}>
              <ExternalLink className="mr-1 h-4 w-4" />
              去B站
            </Button>
            <Button variant="outline" onClick={handleReload}>
              <RefreshCw className="mr-1 h-4 w-4" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
