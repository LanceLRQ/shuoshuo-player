import { create } from 'zustand';
import type { LyricEntry } from '../types';

interface LyricsState {
  lyricMaps: Record<string, LyricEntry>;

  updateLyric: (entry: LyricEntry) => void;
  removeLyric: (bvid: string) => void;
}

export const useLyricsStore = create<LyricsState>((set) => ({
  lyricMaps: {},

  updateLyric: (entry) =>
    set((state) => ({
      lyricMaps: {
        ...state.lyricMaps,
        [entry.bvid]: { ...state.lyricMaps[entry.bvid], ...entry },
      },
    })),

  removeLyric: (bvid) =>
    set((state) => {
      const { [bvid]: _omit, ...rest } = state.lyricMaps;
      void _omit;
      return { lyricMaps: rest };
    }),
}));
