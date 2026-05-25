import { create } from 'zustand';
import type { BilibiliVideo, FavListType } from '@shuoshuo-player/shared';

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
  /** 待添加的 bvid 列表；单条添加时长度=1，批量添加时长度>1 */
  addToFavBvids: string[];
  addToFavExcludeId: string | null;
  addToFavFromSearch: boolean;
  openAddToFav: (
    bvid: string,
    options?: { excludeFavId?: string | null; fromSearch?: boolean },
  ) => void;
  /** 批量添加多条到歌单（搜索发现页批量选择模式入口） */
  openAddToFavBatch: (bvids: string[], options?: { fromSearch?: boolean }) => void;
  closeAddToFav: () => void;

  /** PagesPickerDialog：VideoItem 三点菜单触发，多选分 P 加入歌单 */
  pagesPickerOpen: boolean;
  pagesPickerVideo: BilibiliVideo | null;
  openPagesPicker: (video: BilibiliVideo) => void;
  closePagesPicker: () => void;

  /** 通用确认弹窗 */
  confirmOpen: boolean;
  confirmConfig: ConfirmConfig | null;
  openConfirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;

  /** 歌词面板：占据 main 视图的开关（NavMenu/TopBar/Footer 仍可见） */
  showLyric: boolean;
  toggleLyric: () => void;
  closeLyric: () => void;

  /** 是否有歌词编辑器处于活动编辑态（LyricEditor mount）；供播放核心在曲终时改循环不切歌 */
  lyricEditing: boolean;
  setLyricEditing: (editing: boolean) => void;
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
  addToFavBvids: [],
  addToFavExcludeId: null,
  addToFavFromSearch: false,
  openAddToFav: (bvid, options) =>
    set({
      addToFavOpen: true,
      addToFavBvids: [bvid],
      addToFavExcludeId: options?.excludeFavId ?? null,
      addToFavFromSearch: options?.fromSearch ?? false,
    }),
  openAddToFavBatch: (bvids, options) =>
    set({
      addToFavOpen: true,
      addToFavBvids: [...bvids],
      addToFavExcludeId: null,
      addToFavFromSearch: options?.fromSearch ?? false,
    }),
  closeAddToFav: () =>
    set({
      addToFavOpen: false,
      addToFavBvids: [],
      addToFavExcludeId: null,
      addToFavFromSearch: false,
    }),

  pagesPickerOpen: false,
  pagesPickerVideo: null,
  openPagesPicker: (video) => set({ pagesPickerOpen: true, pagesPickerVideo: video }),
  closePagesPicker: () => set({ pagesPickerOpen: false, pagesPickerVideo: null }),

  confirmOpen: false,
  confirmConfig: null,
  openConfirm: (config) => set({ confirmOpen: true, confirmConfig: config }),
  closeConfirm: () => set({ confirmOpen: false, confirmConfig: null }),

  showLyric: false,
  toggleLyric: () => set((s) => ({ showLyric: !s.showLyric })),
  closeLyric: () => set({ showLyric: false }),

  lyricEditing: false,
  setLyricEditing: (editing) => set({ lyricEditing: editing }),
}));
