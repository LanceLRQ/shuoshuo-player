import { create } from 'zustand';

/**
 * 播放器运行时状态（高频更新，仅给"非主控"消费方订阅用）
 *
 * useMusicPlayer 是带 Howl 副作用的"主控"hook，每个调用方会创建一个独立 Howl 实例。
 * 为避免 LyricViewer 等订阅型组件重复实例化主控，把 progress / duration 这类高频运行时
 * 数据从 useMusicPlayer 内部 useState 同步到此 store；非主控组件直接订阅本 store 即可。
 *
 * 数据源唯一性：只允许 useMusicPlayer 内部写入；其他组件只读。
 */
interface PlayerRuntimeState {
  /** 当前播放进度（秒） */
  progress: number;
  /** 当前曲目总时长（秒） */
  duration: number;
  /** 是否正在播放（由 useMusicPlayer 同步；供托盘菜单等非主控消费方使用） */
  isPlaying: boolean;
  /** 跳转到指定秒数。useMusicPlayer 主控 hook mount 时注册；未注册时为 undefined（noop） */
  seek?: (seconds: number) => void;
  /** 当前实际播放的分 P（与 store.current TrackId 解耦的运行时状态；自 C3 起由 useMusicPlayer 同步） */
  playingPage: number;
  /**
   * 切换到当前 bvid 的指定分 P（主控 hook 注册）。
   * 调用方（PlayingQueue / SPlayer P 选择器）通过它请求重载音频流；
   * 内部仅触发 Howl 重建，不动 usePlayingListStore.current（保持用户视角 TrackId 稳定）。
   */
  switchToPage?: (page: number) => void;
  /**
   * 播放/暂停切换函数指针，主控 hook 注册。供托盘菜单、全局快捷键等
   * 非 React 上下文（事件回调）通过 getState() 调用。未注册时 undefined（noop）。
   */
  togglePlay?: () => void;
  /** 切到下一首（同 togglePlay 的注册模式） */
  goNext?: () => void;
  /** 切到上一首 */
  goPrev?: () => void;
}

export const usePlayerRuntimeStore = create<PlayerRuntimeState>(() => ({
  progress: 0,
  duration: 0,
  isPlaying: false,
  playingPage: 1,
}));
