import { create } from 'zustand';
import type {
  CloseAction,
  CollectionPlayBehavior,
  FloatingLyricsConfig,
  FloatingLyricsAlign,
  FloatingLyricsFamily,
  FloatingLyricsWeight,
  FloatingLyricsColor,
  LoopMode,
  PlayerProfile,
  VideoListViewMode,
} from '../types';
import {
  DEFAULT_CLOSE_ACTION,
  DEFAULT_COLLECTION_PLAY_BEHAVIOR,
  DEFAULT_FAV_VIEW_MODE,
  DEFAULT_FLOATING_LYRICS,
  DEFAULT_HOME_VIEW_MODE,
  DEFAULT_PRIMARY_COLOR,
} from '../types';

const CLOSE_ACTION_SET: ReadonlySet<CloseAction> = new Set<CloseAction>([
  'exit',
  'minimize-to-tray',
]);

const COLLECTION_PLAY_BEHAVIOR_SET: ReadonlySet<CollectionPlayBehavior> =
  new Set<CollectionPlayBehavior>(['replace', 'append']);

const VIEW_MODE_SET: ReadonlySet<VideoListViewMode> = new Set<VideoListViewMode>([
  'list',
  'thumbnail',
]);

const FLOATING_LYRICS_ALIGN_SET: ReadonlySet<FloatingLyricsAlign> = new Set([
  'left',
  'center',
  'right',
]);
const FLOATING_LYRICS_WEIGHT_SET: ReadonlySet<FloatingLyricsWeight> = new Set(['normal', 'bold']);
const FLOATING_LYRICS_FAMILY_SET: ReadonlySet<FloatingLyricsFamily> = new Set([
  'sans',
  'serif',
  'mono',
]);
const FLOATING_LYRICS_COLOR_SET: ReadonlySet<FloatingLyricsColor> = new Set([
  '',
  'primary',
  'white',
  'black',
  'muted',
]);

/**
 * 字段级 clamp + 白名单校验：防止设置面板或导入的脏数据越界 / 注入非法枚举值。
 * 未提供的字段保持上一次状态（caller 用 store.floatingLyrics 兜底）。
 */
function sanitizeFloatingLyricsPatch(
  patch: Partial<FloatingLyricsConfig>,
  prev: FloatingLyricsConfig,
): FloatingLyricsConfig {
  const next: FloatingLyricsConfig = { ...prev };
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (patch.fontSize !== undefined && Number.isFinite(patch.fontSize)) {
    next.fontSize = Math.min(32, Math.max(12, Math.round(patch.fontSize)));
  }
  if (patch.fontWeight !== undefined && FLOATING_LYRICS_WEIGHT_SET.has(patch.fontWeight)) {
    next.fontWeight = patch.fontWeight;
  }
  if (patch.fontFamily !== undefined && FLOATING_LYRICS_FAMILY_SET.has(patch.fontFamily)) {
    next.fontFamily = patch.fontFamily;
  }
  if (patch.textAlign !== undefined && FLOATING_LYRICS_ALIGN_SET.has(patch.textAlign)) {
    next.textAlign = patch.textAlign;
  }
  if (patch.verticalOffset !== undefined && Number.isFinite(patch.verticalOffset)) {
    next.verticalOffset = Math.min(64, Math.max(16, Math.round(patch.verticalOffset)));
  }
  if (patch.textColor !== undefined && FLOATING_LYRICS_COLOR_SET.has(patch.textColor)) {
    next.textColor = patch.textColor;
  }
  if (patch.bgOpacity !== undefined && Number.isFinite(patch.bgOpacity)) {
    next.bgOpacity = Math.min(1, Math.max(0, patch.bgOpacity));
  }
  return next;
}

interface PlayerProfileState extends PlayerProfile {
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setVolume: (volume: number) => void;
  setLoopMode: (mode: LoopMode) => void;
  setAutoPlay: (autoPlay: boolean) => void;
  setPrimaryColor: (color: string) => void;
  resetPrimaryColor: () => void;
  setAutoPlayNextPage: (enabled: boolean) => void;
  /** 部分更新悬浮歌词配置（patch 内部 clamp + 枚举白名单防御） */
  setFloatingLyrics: (patch: Partial<FloatingLyricsConfig>) => void;
  /** 翻转 enabled —— 供右下角按钮直接调用 */
  toggleFloatingLyrics: () => void;
  /** 重置为 DEFAULT_FLOATING_LYRICS */
  resetFloatingLyrics: () => void;
  /**
   * 设置主窗口关闭行为；非法枚举值忽略以防御导入脏数据。
   * 真正同步到 Rust state 的副作用由桌面端层（packages/desktop）订阅本 store 完成，
   * shared 层只维护内存与持久化态。
   */
  setCloseAction: (action: CloseAction) => void;
  /** 首次引导对话框提交后调用，写入"已展示过"标记 */
  markCloseActionPrompted: () => void;
  /** 重置首次引导标记，让下次启动重新弹引导（设置页"重新显示首次引导"按钮使用） */
  resetCloseActionPrompted: () => void;
  /**
   * 设置「以合集为歌单播放」按钮的队列行为；非法枚举值忽略以防御导入脏数据。
   */
  setCollectionPlayBehavior: (behavior: CollectionPlayBehavior) => void;
  /** 设置首页列表展示模式；非白名单值忽略以防御导入脏数据 */
  setHomeViewMode: (mode: VideoListViewMode) => void;
  /** 设置歌单列表展示模式（所有歌单共享）；非白名单值忽略以防御导入脏数据 */
  setFavViewMode: (mode: VideoListViewMode) => void;
  /** 解析 'auto' 主题为实际 light/dark（依赖 prefers-color-scheme） */
  getEffectiveTheme: () => 'light' | 'dark';
}

export const usePlayerProfileStore = create<PlayerProfileState>((set, get) => ({
  theme: 'auto',
  volume: 0.8,
  autoPlay: false,
  loopMode: 'loop',
  primaryColor: DEFAULT_PRIMARY_COLOR,
  autoPlayNextPage: false,
  floatingLyrics: { ...DEFAULT_FLOATING_LYRICS },
  closeAction: DEFAULT_CLOSE_ACTION,
  closeActionFirstRunPrompted: false,
  collectionPlayBehavior: DEFAULT_COLLECTION_PLAY_BEHAVIOR,
  homeViewMode: DEFAULT_HOME_VIEW_MODE,
  favViewMode: DEFAULT_FAV_VIEW_MODE,

  setTheme: (theme) => set({ theme }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setLoopMode: (mode) => set({ loopMode: mode }),
  setAutoPlay: (autoPlay) => set({ autoPlay }),
  setPrimaryColor: (color) => set({ primaryColor: color || DEFAULT_PRIMARY_COLOR }),
  resetPrimaryColor: () => set({ primaryColor: DEFAULT_PRIMARY_COLOR }),
  setAutoPlayNextPage: (enabled) => set({ autoPlayNextPage: Boolean(enabled) }),

  setFloatingLyrics: (patch) =>
    set((state) => ({ floatingLyrics: sanitizeFloatingLyricsPatch(patch, state.floatingLyrics) })),
  toggleFloatingLyrics: () =>
    set((state) => ({
      floatingLyrics: { ...state.floatingLyrics, enabled: !state.floatingLyrics.enabled },
    })),
  resetFloatingLyrics: () => set({ floatingLyrics: { ...DEFAULT_FLOATING_LYRICS } }),

  setCloseAction: (action) => {
    if (!CLOSE_ACTION_SET.has(action)) return;
    set({ closeAction: action });
  },
  markCloseActionPrompted: () => set({ closeActionFirstRunPrompted: true }),
  resetCloseActionPrompted: () => set({ closeActionFirstRunPrompted: false }),

  setCollectionPlayBehavior: (behavior) => {
    if (!COLLECTION_PLAY_BEHAVIOR_SET.has(behavior)) return;
    set({ collectionPlayBehavior: behavior });
  },

  setHomeViewMode: (mode) => {
    if (!VIEW_MODE_SET.has(mode)) return;
    set({ homeViewMode: mode });
  },
  setFavViewMode: (mode) => {
    if (!VIEW_MODE_SET.has(mode)) return;
    set({ favViewMode: mode });
  },

  getEffectiveTheme: () => {
    const { theme } = get();
    if (theme !== 'auto') return theme;
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
}));
