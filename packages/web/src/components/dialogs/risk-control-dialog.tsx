import {
  useRiskControlStore,
  invalidateMusicUrlCache,
  usePlayingListStore,
  getPlatformBridge,
} from '@shuoshuo-player/shared';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * B 站风控（v_voucher）引导对话框
 *
 * 触发：fetchMusicUrl 检测到 playurl 接口返回 v_voucher 时，shared 层调
 * useRiskControlStore.openRiskControl(voucher, bvid) → 此对话框打开。
 *
 * 流程：
 * 1. "去 B 站主站验证"：在新标签打开 bilibili.com 视频页（B 站对该会话触发
 *    geetest captcha → 用户完成后 x-bili-gaia-vtoken cookie 写入 .bilibili.com 域）
 * 2. host_permissions 含 *.bilibili.com，扩展请求 api.bilibili.com 时浏览器自动携带
 * 3. "已完成验证，重试"：清当前 bvid 的 musicPlayUrlCache + 触发 playNext 重新加载
 */
export function RiskControlDialog() {
  const open = useRiskControlStore((s) => s.open);
  const voucher = useRiskControlStore((s) => s.voucher);
  const bvid = useRiskControlStore((s) => s.bvid);
  const close = useRiskControlStore((s) => s.closeRiskControl);

  const handleOpenBilibili = () => {
    const url = bvid ? `https://www.bilibili.com/video/${bvid}/` : 'https://www.bilibili.com/';
    void getPlatformBridge().shell.openExternal(url);
  };

  const handleRetry = () => {
    if (bvid) invalidateMusicUrlCache(bvid);
    // 通过 playNext 信号让 use-music-player 重新走 initHowl 流程
    usePlayingListStore.setState({ playNext: true });
    close();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>B 站接口被风控</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>为防止滥用，B 站对当前请求触发了人机校验。请按以下步骤恢复播放：</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>点击「去 B 站主站验证」，在新标签打开视频页</li>
                <li>在主站正常播放任意视频（B 站会自动弹 captcha 验证码，按提示完成即可）</li>
                <li>验证通过后回到此页面，点「已完成验证，重试」</li>
              </ol>
              {voucher && (
                <p className="break-all text-xs text-muted-foreground">
                  voucher: {voucher.slice(0, 24)}…
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>关闭</AlertDialogCancel>
          <AlertDialogAction onClick={handleOpenBilibili}>去 B 站主站验证</AlertDialogAction>
          <AlertDialogAction onClick={handleRetry}>已完成验证，重试</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
