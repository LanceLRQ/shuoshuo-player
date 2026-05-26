import { useEffect, useRef } from 'react';
import {
  useUpdateCheckerStore,
  useUIStore,
  NoticeType,
  getPlatformBridge,
  detectPlatformType,
  isNewerVersion,
  isValidVersion,
  type NoticeAction,
} from '@shuoshuo-player/shared';
import { APP_VERSION } from '@/lib/version';
import { CHROME_STORE_URL, OFFICIAL_RELEASE_URL } from '@/lib/links';

/**
 * 更新通知组件（无 DOM 输出）
 *
 * 订阅 useUpdateCheckerStore.latestKnown 变化：
 * - 当持久化的最新版本号严格大于当前 APP_VERSION
 * - 且不在用户主动忽略列表中
 * - 且本次会话未对该版本号弹过 toast
 * 触发一个常驻（duration=null）INFO toast，按平台给出不同的升级入口：
 * - Chrome 扩展：双按钮「Chrome 商店」+「国内下载」（官方发布页）
 * - 桌面端：双按钮「查看详情」（应用内关于页）+「发布页」（GitHub）
 * - 普通 Web：单按钮「查看更新」跳 GitHub 发布页
 *
 * 设计要点：
 * - 用 ref 防止同会话内重复弹（StrictMode / store re-render 抖动）
 * - 用户点任一按钮 = 隐式 ignoreVersion，避免跳转后又被打扰
 * - 用户关闭 toast 不主动 ignoreVersion，下次启动若同一版本仍未升级会再提示一次
 *   （兜底设计：避免用户误关错过升级）
 */
export function UpdateNotifier() {
  const latestKnown = useUpdateCheckerStore((s) => s.latestKnown);
  const ignoredVersions = useUpdateCheckerStore((s) => s.ignoredVersions);
  const ignoreVersion = useUpdateCheckerStore((s) => s.ignoreVersion);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const removeNotice = useUIStore((s) => s.removeNotice);
  const shownVersionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!latestKnown) return;
    if (!isValidVersion(latestKnown.version) || !isValidVersion(APP_VERSION)) return;
    if (!isNewerVersion(latestKnown.version, APP_VERSION)) return;
    if (ignoredVersions.includes(latestKnown.version)) return;
    if (shownVersionRef.current === latestKnown.version) return;

    shownVersionRef.current = latestKnown.version;
    const noticeId = `update-available-${latestKnown.version}`;

    // 点击任一按钮 = 隐式忽略该版本 + 关闭提示，避免跳转后又被打扰
    const dismiss = () => {
      ignoreVersion(latestKnown.version);
      removeNotice(noticeId);
    };
    const openExternal = (url: string) => {
      void getPlatformBridge().shell.openExternal(url);
      dismiss();
    };
    const goAboutPage = () => {
      // UpdateNotifier 挂在 RouterProvider 外，无法用 useNavigate；项目是 Hash Router，改 hash 即导航
      window.location.hash = '#/settings?tab=about';
      dismiss();
    };

    let action: NoticeAction | undefined;
    let actions: NoticeAction[] | undefined;

    switch (detectPlatformType()) {
      case 'chrome-extension':
        // 扩展走 Web Store 自动更新，引导去商店；商店国内访问受限，再给官方发布页兜底
        actions = [
          { label: 'Chrome 商店', onClick: () => openExternal(CHROME_STORE_URL) },
          { label: '国内下载', onClick: () => openExternal(OFFICIAL_RELEASE_URL) },
        ];
        break;
      case 'tauri':
        // 桌面端无商店：引导去应用内关于页看详情，或直接去 GitHub 发布页下载安装包
        actions = [
          { label: '查看详情', onClick: goAboutPage },
          { label: '发布页', onClick: () => openExternal(latestKnown.release_url) },
        ];
        break;
      default:
        // 普通 Web：保持单按钮跳 GitHub 发布页
        action = { label: '查看更新', onClick: () => openExternal(latestKnown.release_url) };
    }

    sendNotice({
      id: noticeId,
      type: NoticeType.INFO,
      message: `发现新版本 ${latestKnown.tag}，建议升级`,
      duration: null,
      close: true,
      action,
      actions,
    });
  }, [latestKnown, ignoredVersions, sendNotice, removeNotice, ignoreVersion]);

  // dev 调试：控制台调用 window.__sspMockUpdate('99.0.0') 注入新版本以预览提示。
  // 在 dev:web 下先伪造平台标记可预览各端样式：
  //   window.chrome = { runtime: { id: 'x' } }   → Chrome 扩展双按钮
  //   window.__TAURI_INTERNALS__ = {}            → 桌面端双按钮
  // 重复触发请换一个更高的版本号（同会话同版本只弹一次）。prod 构建此块整体 DCE。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __sspMockUpdate?: (v?: string) => void };
    w.__sspMockUpdate = (v = '99.0.0') => {
      useUpdateCheckerStore.setState({
        lastCheckedAt: new Date().toISOString(),
        ignoredVersions: [],
        latestKnown: {
          version: v,
          tag: `v${v}`,
          channel: 'stable',
          pub_date: new Date().toISOString(),
          release_url: 'https://github.com/LanceLRQ/shuoshuo-player/releases/latest',
          notes_url: 'https://github.com/LanceLRQ/shuoshuo-player/releases/latest',
        },
      });
    };
    return () => {
      delete w.__sspMockUpdate;
    };
  }, []);

  return null;
}
