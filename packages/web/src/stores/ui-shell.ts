import { create } from 'zustand';
import type { FavListType } from '@shuoshuo-player/shared';

/** 新建模式下预填字段（仅 type/mid/name；编辑模式忽略） */
export interface FavEditPrefill {
  type?: FavListType;
  /** UPLOADER 类型时填入空间 UID 或 URL（getBilibiliMidByURL 解析） */
  midInput?: string;
  name?: string;
}

interface UIShellState {
  menuOpen: boolean;
  toggleMenu: () => void;
  setMenuOpen: (open: boolean) => void;

  cloudLoginOpen: boolean;
  openCloudLogin: () => void;
  closeCloudLogin: () => void;

  favEditOpen: boolean;
  /** 编辑现有歌单时携带 id，新建时为 null */
  favEditTargetId: string | null;
  /** 新建模式下的预填字段（来自直播切片页"一键关注"等场景） */
  favEditPrefill: FavEditPrefill | null;
  openFavEdit: (id?: string | null, prefill?: FavEditPrefill) => void;
  closeFavEdit: () => void;

  addSongOpen: boolean;
  addSongTargetFavId: string | null;
  openAddSong: (favId: string) => void;
  closeAddSong: () => void;

  addToFavOpen: boolean;
  addToFavBvid: string | null;
  addToFavExcludeId: string | null;
  addToFavFromSearch: boolean;
  openAddToFav: (
    bvid: string,
    options?: { excludeFavId?: string | null; fromSearch?: boolean },
  ) => void;
  closeAddToFav: () => void;

  /** 通用确认弹窗 */
  confirmOpen: boolean;
  confirmConfig: ConfirmConfig | null;
  openConfirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;

  /** 歌词面板：占据 main 视图的开关（NavMenu/TopBar/Footer 仍可见） */
  showLyric: boolean;
  toggleLyric: () => void;
  closeLyric: () => void;
}

export interface ConfirmConfig {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export const useUIShell = create<UIShellState>((set) => ({
  menuOpen: true,
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),

  cloudLoginOpen: false,
  openCloudLogin: () => set({ cloudLoginOpen: true }),
  closeCloudLogin: () => set({ cloudLoginOpen: false }),

  favEditOpen: false,
  favEditTargetId: null,
  favEditPrefill: null,
  openFavEdit: (id = null, prefill) =>
    set({
      favEditOpen: true,
      favEditTargetId: id,
      favEditPrefill: prefill ?? null,
    }),
  closeFavEdit: () => set({ favEditOpen: false, favEditTargetId: null, favEditPrefill: null }),

  addSongOpen: false,
  addSongTargetFavId: null,
  openAddSong: (favId) => set({ addSongOpen: true, addSongTargetFavId: favId }),
  closeAddSong: () => set({ addSongOpen: false, addSongTargetFavId: null }),

  addToFavOpen: false,
  addToFavBvid: null,
  addToFavExcludeId: null,
  addToFavFromSearch: false,
  openAddToFav: (bvid, options) =>
    set({
      addToFavOpen: true,
      addToFavBvid: bvid,
      addToFavExcludeId: options?.excludeFavId ?? null,
      addToFavFromSearch: options?.fromSearch ?? false,
    }),
  closeAddToFav: () =>
    set({
      addToFavOpen: false,
      addToFavBvid: null,
      addToFavExcludeId: null,
      addToFavFromSearch: false,
    }),

  confirmOpen: false,
  confirmConfig: null,
  openConfirm: (config) => set({ confirmOpen: true, confirmConfig: config }),
  closeConfirm: () => set({ confirmOpen: false, confirmConfig: null }),

  showLyric: false,
  toggleLyric: () => set((s) => ({ showLyric: !s.showLyric })),
  closeLyric: () => set({ showLyric: false }),
}));
