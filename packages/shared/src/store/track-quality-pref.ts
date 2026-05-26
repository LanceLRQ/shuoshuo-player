import { create } from 'zustand';
import type { AudioQualityPreference } from '../types';

/**
 * 单曲音频音质偏好（按 bvid 覆盖全局默认音质）
 *
 * 仅记录"用户为某首单独设过的音质覆盖"；未设的 bvid 取流时跟随全局
 * usePlayerProfileStore.defaultAudioQuality。清除覆盖（"跟随全局"）即删 key，
 * 避免长期累积大量 key 撑大 player_data（与 video-page-pref 同策略）。
 *
 * 覆盖值可以是 'auto'（这首单独走自动最高，区别于"跟随全局"——后者用全局设的档）。
 * 取流消费见 utils/music-url.ts：getQuality(bvid) ?? 全局默认。
 *
 * 粒度按 bvid（整投稿所有 P 共用一档），与取流 (bvid, page) 模型兼容。
 */
interface TrackQualityPrefState {
  /** bvid → 覆盖音质 */
  quality: Record<string, AudioQualityPreference>;

  /** 设置某 bvid 的覆盖音质 */
  setQuality: (bvid: string, quality: AudioQualityPreference) => void;
  /** 清除某 bvid 的覆盖（恢复"跟随全局"） */
  clearQuality: (bvid: string) => void;
  /** 读取覆盖音质；无覆盖返回 undefined（表示跟随全局） */
  getQuality: (bvid: string) => AudioQualityPreference | undefined;
}

export const useTrackQualityPrefStore = create<TrackQualityPrefState>((set, get) => ({
  quality: {},

  setQuality: (bvid, quality) => {
    if (!bvid) return;
    set((state) => ({
      quality: { ...state.quality, [bvid]: quality },
    }));
  },

  clearQuality: (bvid) => {
    const existing = get().quality;
    if (!(bvid in existing)) return;
    const next = { ...existing };
    delete next[bvid];
    set({ quality: next });
  },

  getQuality: (bvid) => {
    return get().quality[bvid];
  },
}));
