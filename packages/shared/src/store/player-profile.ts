import { create } from 'zustand';
import type { LoopMode, PlayerProfile } from '../types';

interface PlayerProfileState extends PlayerProfile {
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setVolume: (volume: number) => void;
  setLoopMode: (mode: LoopMode) => void;
  setAutoPlay: (autoPlay: boolean) => void;
  /** 解析 'auto' 主题为实际 light/dark（依赖 prefers-color-scheme） */
  getEffectiveTheme: () => 'light' | 'dark';
}

export const usePlayerProfileStore = create<PlayerProfileState>((set, get) => ({
  theme: 'auto',
  volume: 0.8,
  autoPlay: false,
  loopMode: 'loop',

  setTheme: (theme) => set({ theme }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setLoopMode: (mode) => set({ loopMode: mode }),
  setAutoPlay: (autoPlay) => set({ autoPlay }),

  getEffectiveTheme: () => {
    const { theme } = get();
    if (theme !== 'auto') return theme;
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
}));
