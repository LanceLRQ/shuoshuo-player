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
  /** 跳转到指定秒数。useMusicPlayer 主控 hook mount 时注册；未注册时为 undefined（noop） */
  seek?: (seconds: number) => void;
}

export const usePlayerRuntimeStore = create<PlayerRuntimeState>(() => ({
  progress: 0,
  duration: 0,
}));
