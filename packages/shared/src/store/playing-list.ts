import { create } from 'zustand';
import type { LoopMode } from '../types';

interface PlayingListState {
  favId: string;
  bvIds: string[];
  current: string;
  /** 上一个动作希望立即开始播放（由 SPlayer 消费后通过 clearPlayNext 复位） */
  playNext: boolean;

  addSingle: (bvId: string, playNow?: boolean) => void;
  setPlaylist: (favId: string, bvIds: string[], current?: string, playNow?: boolean) => void;
  removeItem: (bvId: string) => void;
  clearPlaylist: () => void;
  updateCurrentPlaying: (index: number, playNext?: boolean) => void;
  clearPlayNext: () => void;
  getNextIndex: (loopMode: LoopMode) => number;
  getPrevIndex: (loopMode: LoopMode) => number;
}

export const usePlayingListStore = create<PlayingListState>((set, get) => ({
  favId: '',
  bvIds: [],
  current: '',
  playNext: false,

  addSingle: (bvId, playNow = false) =>
    set((state) => {
      const bvIds = state.bvIds.includes(bvId) ? state.bvIds : [...state.bvIds, bvId];
      return {
        bvIds,
        ...(playNow ? { current: bvId, playNext: true } : {}),
      };
    }),

  setPlaylist: (favId, bvIds, current, playNow = false) =>
    set({
      favId,
      bvIds,
      current: current || bvIds[0] || '',
      playNext: playNow,
    }),

  removeItem: (bvId) =>
    set((state) => {
      const bvIds = state.bvIds.filter((id) => id !== bvId);
      const isCurrent = state.current === bvId;
      const currentIndex = state.bvIds.indexOf(bvId);
      return {
        bvIds,
        current: isCurrent ? bvIds[Math.min(currentIndex, bvIds.length - 1)] || '' : state.current,
        playNext: isCurrent,
      };
    }),

  clearPlaylist: () => set({ favId: '', bvIds: [], current: '', playNext: false }),

  updateCurrentPlaying: (index, playNext = true) =>
    set((state) => {
      const next = state.bvIds[index] || '';
      if (next === state.current && !playNext) return state;
      return { current: next, playNext };
    }),

  clearPlayNext: () => set({ playNext: false }),

  getNextIndex: (loopMode) => {
    const { bvIds, current } = get();
    if (bvIds.length === 0) return -1;
    const currentIndex = bvIds.indexOf(current);
    if (loopMode === 'single') return currentIndex;
    if (loopMode === 'random') return Math.floor(Math.random() * bvIds.length);
    return (currentIndex + 1) % bvIds.length;
  },

  getPrevIndex: (loopMode) => {
    const { bvIds, current } = get();
    if (bvIds.length === 0) return -1;
    const currentIndex = bvIds.indexOf(current);
    if (loopMode === 'single') return currentIndex;
    if (loopMode === 'random') return Math.floor(Math.random() * bvIds.length);
    return (currentIndex - 1 + bvIds.length) % bvIds.length;
  },
}));
