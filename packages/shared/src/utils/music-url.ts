import { VideoApi } from '../api';
import {
  AUDIO_QUALITY,
  MUSIC_URL_CACHE_TTL,
  CLICK_STAT_THROTTLE,
  CLICK_STAT_DELAY_MS,
} from '../constants';
import { timeStampNow } from './format';
import type { DashAudioStream, MusicUrlCache } from '../types';
import type { VideoViewInfo } from '../api/bilibili/video';

/** 全局缓存：bvid → MusicUrlCache（v1 window.MUSIC_PLAY_URL_CACHED 等价，但封装在模块作用域） */
const musicPlayUrlCache: Record<string, MusicUrlCache> = {};
/** 模拟点击节流：bvid → 上次发送时间（秒） */
const musicPlayClickTime: Record<string, number> = {};

/** 选取首个非 xy 代理的 URL */
function pickPlayableUrl(audioInfo: DashAudioStream | undefined): string {
  if (!audioInfo) return '';
  const u1 = audioInfo.baseUrl || '';
  const u2 = audioInfo.backup_url?.[0] || '';
  const u3 = audioInfo.backup_url?.[1] || '';
  const usable = [u1, u2, u3].filter((u) => u && !u.startsWith('https://xy'));
  return usable[0] || u1;
}

/**
 * 获取 B 站视频音频流 URL（含缓存 / 音质降级 / 模拟点击统计）
 *
 * 与 v1 行为完全对齐：
 * 1. 1 小时（MUSIC_URL_CACHE_TTL）内同 bvid 命中缓存，不重复请求
 * 2. loading 标记防并发
 * 3. 音质降级链：30280 (192K) → 30232 (132K) → 30216 (64K)
 * 4. 成功后 500ms 延迟发起一次 doClickStat（同一视频 600s 节流）
 */
export async function fetchMusicUrl(
  bvId: string,
  currentUserMid?: string | number,
): Promise<string> {
  const cached = (musicPlayUrlCache[bvId] ??= {
    loading: false,
    last_update: 0,
    viewInfo: {},
    playInfo: {},
    playUrl: '',
  });

  if (cached.loading) return '';
  if (cached.last_update > 0 && cached.last_update + MUSIC_URL_CACHE_TTL > timeStampNow()) {
    return cached.playUrl;
  }

  cached.loading = true;
  try {
    const viewInfo = (await VideoApi.getVideoViewInfo({
      params: { bvid: bvId },
    })) as VideoViewInfo & { cid?: number; aid?: number };

    const cid = viewInfo?.cid ?? 0;
    const playInfo = await VideoApi.getVideoPlayurl({
      params: { cid, fnval: 16, bvid: bvId },
    });

    const audioList = playInfo?.dash?.audio ?? [];
    const findById = (id: number): DashAudioStream | undefined =>
      audioList.find((a) => a?.id === id);
    const audio =
      findById(AUDIO_QUALITY.HIGH) || findById(AUDIO_QUALITY.MEDIUM) || findById(AUDIO_QUALITY.LOW);

    cached.viewInfo = viewInfo as unknown as Record<string, unknown>;
    cached.playInfo = playInfo as unknown as Record<string, unknown>;
    cached.playUrl = pickPlayableUrl(audio);
    cached.last_update = timeStampNow();
    cached.loading = false;

    // 异步发起模拟点击（节流 600s）
    setTimeout(() => {
      const now = timeStampNow();
      if ((musicPlayClickTime[bvId] ?? 0) + CLICK_STAT_THROTTLE > now) return;
      const aid = viewInfo?.aid;
      const type = viewInfo?.desc_v2?.[0]?.type ?? '1';
      VideoApi.doClickStat({
        params: {
          w_aid: aid,
          w_part: 1,
          w_ftime: now,
          w_stime: now,
          w_type: type,
        },
        data: {
          aid,
          cid: viewInfo?.cid,
          bvid: bvId,
          part: '1',
          ftime: now,
          stime: now,
          mid: currentUserMid,
          type,
          sub_type: '0',
        },
      })
        .then(() => {
          musicPlayClickTime[bvId] = timeStampNow();
        })
        .catch((e) => {
          console.debug('B站模拟点击失败：', e);
        });
    }, CLICK_STAT_DELAY_MS);

    return cached.playUrl;
  } catch (e) {
    cached.loading = false;
    console.debug(e);
    return '';
  }
}
