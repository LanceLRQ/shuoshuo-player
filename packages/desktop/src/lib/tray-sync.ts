import { listen } from '@tauri-apps/api/event';
import {
  trackIdToBvid,
  useBilibiliVideosStore,
  usePlayingListStore,
} from '@shuoshuo-player/shared';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { setTrayPlayState, setTrayTrackLabel } from './tray-bridge';

/** 标题最长 40 字符，超出加省略号，避免菜单变形（macOS menubar 宽度敏感） */
const MAX_TRACK_LABEL_LENGTH = 40;

/** 标题/作者更新的尾沿节流窗口；切歌瞬间多次 setState 合并为一次 invoke */
const LABEL_PUSH_THROTTLE_MS = 200;

/**
 * 把 PlayerRuntime + 当前曲目状态同步到 Rust 端托盘菜单，
 * 并监听 Rust 派来的菜单事件分发到 store 中注册的播放控制函数指针。
 *
 * 启动时机：bootstrapPersistence 完成后调用一次（main.tsx）。
 * 应用生命周期内驻留，不返回 cleanup——desktop 主窗只一个，无重复挂载场景。
 */
export function startTraySync(): void {
  startTrackLabelSync();
  startPlayStateSync();
  startCommandListener();
}

/** 派生当前曲目展示文案："♪ 标题 - 作者"；未播放或缺数据时空串 */
function deriveTrackLabel(
  currentTrackId: string,
  entities: ReturnType<typeof useBilibiliVideosStore.getState>['entities'],
): string {
  if (!currentTrackId) return '';
  const bvid = trackIdToBvid(currentTrackId);
  const video = entities[bvid];
  if (!video?.title) return '';
  const author = video.author ? ` - ${video.author}` : '';
  let label = `♪ ${video.title}${author}`;
  if (label.length > MAX_TRACK_LABEL_LENGTH) {
    label = `${label.slice(0, MAX_TRACK_LABEL_LENGTH - 1)}…`;
  }
  return label;
}

function startTrackLabelSync(): void {
  let lastLabel: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingLabel: string | null = null;

  const push = (label: string): void => {
    if (label === lastLabel) return;
    lastLabel = label;
    void setTrayTrackLabel(label).catch((err) => {
      console.warn('[tray-sync] setTrayTrackLabel failed:', err);
    });
  };

  // 尾沿节流：高频 setState 合并为单次 invoke；trailing edge 保证最后值一定生效
  const schedule = (label: string): void => {
    pendingLabel = label;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const next = pendingLabel;
      pendingLabel = null;
      if (next !== null) push(next);
    }, LABEL_PUSH_THROTTLE_MS);
  };

  const recompute = (): void => {
    const current = usePlayingListStore.getState().current;
    const entities = useBilibiliVideosStore.getState().entities;
    schedule(deriveTrackLabel(current, entities));
  };

  // 启动期同步一次，让 Rust state 与持久化恢复后的曲目对齐
  recompute();

  // 两个 store 任一变化都重算（标题来自 entities，trackId 来自 playing-list）
  usePlayingListStore.subscribe(recompute);
  useBilibiliVideosStore.subscribe(recompute);
}

function startPlayStateSync(): void {
  let lastIsPlaying: boolean | null = null;
  const apply = (isPlaying: boolean): void => {
    if (isPlaying === lastIsPlaying) return;
    lastIsPlaying = isPlaying;
    void setTrayPlayState(isPlaying).catch((err) => {
      console.warn('[tray-sync] setTrayPlayState failed:', err);
    });
  };
  apply(usePlayerRuntimeStore.getState().isPlaying);
  usePlayerRuntimeStore.subscribe((state) => apply(state.isPlaying));
}

function startCommandListener(): void {
  // Rust 端在用户点托盘菜单时 emit('tray:command', id)；
  // 我们从 player-runtime store 取函数指针调用，跟 React 组件树解耦
  void listen<string>('tray:command', (event) => {
    const id = event.payload;
    const runtime = usePlayerRuntimeStore.getState();
    switch (id) {
      case 'play-pause':
        runtime.togglePlay?.();
        break;
      case 'next':
        runtime.goNext?.();
        break;
      case 'prev':
        runtime.goPrev?.();
        break;
      default:
        // 'show-window' / 'open-settings' 等由 Rust 直接处理或走另一事件，无需此处分发
        break;
    }
  }).catch((err) => {
    console.warn('[tray-sync] listen tray:command failed:', err);
  });
}
