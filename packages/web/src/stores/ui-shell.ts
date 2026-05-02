import { create } from 'zustand';

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
  openFavEdit: (id?: string | null) => void;
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
  openFavEdit: (id = null) => set({ favEditOpen: true, favEditTargetId: id }),
  closeFavEdit: () => set({ favEditOpen: false, favEditTargetId: null }),

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
}));
