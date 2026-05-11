import { useEffect, useRef } from 'react';
import {
  useUpdateCheckerStore,
  useUIStore,
  NoticeType,
  getPlatformBridge,
  isNewerVersion,
  isValidVersion,
} from '@shuoshuo-player/shared';
import { APP_VERSION } from '@/lib/version';

/**
 * 更新通知组件（无 DOM 输出）
 *
 * 订阅 useUpdateCheckerStore.latestKnown 变化：
 * - 当持久化的最新版本号严格大于当前 APP_VERSION
 * - 且不在用户主动忽略列表中
 * - 且本次会话未对该版本号弹过 toast
 * 触发一个常驻（duration=null）INFO toast，带"查看更新"按钮跳转 release_url。
 *
 * 设计要点：
 * - 用 ref 防止同会话内重复弹（StrictMode / store re-render 抖动）
 * - 用户点"查看更新"=隐式 ignoreVersion，避免外链打开后又被打扰
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

    sendNotice({
      id: noticeId,
      type: NoticeType.INFO,
      message: `发现新版本 ${latestKnown.tag}，建议升级`,
      duration: null,
      close: true,
      action: {
        label: '查看更新',
        onClick: () => {
          void getPlatformBridge().shell.openExternal(latestKnown.release_url);
          ignoreVersion(latestKnown.version);
          removeNotice(noticeId);
        },
      },
    });
  }, [latestKnown, ignoredVersions, sendNotice, removeNotice, ignoreVersion]);

  return null;
}
