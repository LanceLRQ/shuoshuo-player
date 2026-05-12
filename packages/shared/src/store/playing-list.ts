import { create } from 'zustand';
import type { LoopMode } from '../types';

/**
 * 播放队列
 *
 * 队列元素称为 TrackId，可为：
 * - 纯 bvid（如 'BV1aB4y1k7Yx'）→ 按该投稿"默认 P / P1"播放
 * - bvid:p<n>（如 'BV1aB4y1k7Yx:p3'）→ 显式锁定该 P
 *
 * 自 B2 起字段从 bvIds 重命名为 trackIds，更精确表达"队列条目可能含分 P 标识"。
 * 持久化 hydrate 路径仍兼容旧 bvIds 字段（见 middleware/persist.ts）。
 */
interface PlayingListState {
  favId: string;
  trackIds: string[];
  current: string;
  /** 上一个动作希望立即开始播放（由 SPlayer 消费后通过 clearPlayNext 复位） */
  playNext: boolean;

  addSingle: (trackId: string, playNow?: boolean) => void;
  setPlaylist: (favId: string, trackIds: string[], current?: string, playNow?: boolean) => void;
  removeItem: (trackId: string) => void;
  clearPlaylist: () => void;
  updateCurrentPlaying: (index: number, playNext?: boolean) => void;
  clearPlayNext: () => void;
  getNextIndex: (loopMode: LoopMode) => number;
  getPrevIndex: (loopMode: LoopMode) => number;
}

export const usePlayingListStore = create<PlayingListState>((set, get) => ({
  favId: '',
  trackIds: [],
  current: '',
  playNext: false,

  addSingle: (trackId, playNow = false) =>
    set((state) => {
      const trackIds = state.trackIds.includes(trackId)
        ? state.trackIds
        : [...state.trackIds, trackId];
      return {
        trackIds,
        ...(playNow ? { current: trackId, playNext: true } : {}),
      };
    }),

  setPlaylist: (favId, trackIds, current, playNow = false) =>
    set({
      favId,
      trackIds,
      current: current || trackIds[0] || '',
      playNext: playNow,
    }),

  removeItem: (trackId) =>
    set((state) => {
      const trackIds = state.trackIds.filter((id) => id !== trackId);
      const isCurrent = state.current === trackId;
      const currentIndex = state.trackIds.indexOf(trackId);
      return {
        trackIds,
        current: isCurrent
          ? trackIds[Math.min(currentIndex, trackIds.length - 1)] || ''
          : state.current,
        playNext: isCurrent,
      };
    }),

  clearPlaylist: () => set({ favId: '', trackIds: [], current: '', playNext: false }),

  updateCurrentPlaying: (index, playNext = true) =>
    set((state) => {
      const next = state.trackIds[index] || '';
      if (next === state.current && !playNext) return state;
      return { current: next, playNext };
    }),

  clearPlayNext: () => set({ playNext: false }),

  getNextIndex: (loopMode) => {
    const { trackIds, current } = get();
    if (trackIds.length === 0) return -1;
    const currentIndex = trackIds.indexOf(current);
    if (loopMode === 'single') return currentIndex;
    if (loopMode === 'random') return Math.floor(Math.random() * trackIds.length);
    return (currentIndex + 1) % trackIds.length;
  },

  getPrevIndex: (loopMode) => {
    const { trackIds, current } = get();
    if (trackIds.length === 0) return -1;
    const currentIndex = trackIds.indexOf(current);
    if (loopMode === 'single') return currentIndex;
    if (loopMode === 'random') return Math.floor(Math.random() * trackIds.length);
    return (currentIndex - 1 + trackIds.length) % trackIds.length;
  },
}));
