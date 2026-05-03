import { VideoApi } from '../api';
import {
  AUDIO_QUALITY,
  MUSIC_URL_CACHE_TTL,
  CLICK_STAT_THROTTLE,
  CLICK_STAT_DELAY_MS,
} from '../constants';
import { useRiskControlStore } from '../store/risk-control';
import { timeStampNow } from './format';
import type { DashAudioStream, MusicUrlCache } from '../types';
import type { VideoViewInfo } from '../api/bilibili/video';

/** 全局缓存：bvid → MusicUrlCache（v1 window.MUSIC_PLAY_URL_CACHED 等价，但封装在模块作用域） */
const musicPlayUrlCache: Record<string, MusicUrlCache> = {};
/** 模拟点击节流：bvid → 上次发送时间（秒） */
const musicPlayClickTime: Record<string, number> = {};
/**
 * 同 bvid 并发请求复用同一个 Promise（避免 React strict mode useEffect 双触发或
 * 上下游 effect 重复调用时，第二次抢到 cached.loading=true 后早返回 '' → goNext 误跳下一首）
 */
const inflightRequests: Record<string, Promise<string>> = {};

/** 选取首个非 xy 代理的 URL（B 站 dash 字段名是 base_url，不是 baseUrl） */
function pickPlayableUrl(audioInfo: DashAudioStream | undefined): string {
  if (!audioInfo) return '';
  const u1 = audioInfo.base_url || '';
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
  if (__DEV_LOG__) console.debug('[BILI-API] fetchMusicUrl enter:', bvId);

  // 命中已有 inflight 请求：所有并发调用共享同一个 Promise，避免 race
  const existing = inflightRequests[bvId];
  if (existing) {
    if (__DEV_LOG__) console.debug('[BILI-API] fetchMusicUrl inflight hit:', bvId);
    return existing;
  }

  const cached = (musicPlayUrlCache[bvId] ??= {
    loading: false,
    last_update: 0,
    viewInfo: {},
    playInfo: {},
    playUrl: '',
  });

  // 命中 1 小时缓存
  if (cached.last_update > 0 && cached.last_update + MUSIC_URL_CACHE_TTL > timeStampNow()) {
    if (__DEV_LOG__) {
      console.debug(
        '[BILI-API] fetchMusicUrl cache hit:',
        bvId,
        'playUrl=',
        cached.playUrl ? cached.playUrl.slice(0, 80) + '...' : '<EMPTY>',
      );
    }
    return cached.playUrl;
  }

  const promise = (async () => {
    cached.loading = true;
    try {
      const viewInfo = (await VideoApi.getVideoViewInfo({
        params: { bvid: bvId },
      })) as VideoViewInfo & { cid?: number; aid?: number };

      if (__DEV_LOG__) {
        console.debug(
          '[BILI-API] viewInfo ok:',
          bvId,
          'cid=',
          viewInfo?.cid,
          'aid=',
          viewInfo?.aid,
        );
      }

      const cid = viewInfo?.cid ?? 0;
      const playInfo = await VideoApi.getVideoPlayurl({
        params: { cid, fnval: 16, bvid: bvId },
      });

      // 风控检测：B 站对异常 wbi 签名 / 缺 Cookie / 频繁请求会返回 code=0 但 data 只含
      // v_voucher（详见 docs/misc/sign/v_voucher.md）。触发全局风控对话框引导用户主站验证。
      const voucher = (playInfo as { v_voucher?: string } | undefined)?.v_voucher;
      if (voucher) {
        if (__DEV_LOG__) {
          console.debug(
            '[BILI-API] playurl v_voucher 风控:',
            bvId,
            voucher,
            '\n建议：1) 访问 bilibili.com 主站完成 captcha 校验  2) 稍后重试',
          );
        }
        useRiskControlStore.getState().openRiskControl(voucher, bvId);
        throw new Error(`B 站风控（v_voucher）：${voucher.slice(0, 32)}`);
      }

      const audioList = playInfo?.dash?.audio ?? [];
      const findById = (id: number): DashAudioStream | undefined =>
        audioList.find((a) => a?.id === id);
      // 标准音质优先 → 任意 dash.audio → flac → dolby → durl
      const dashExtra = playInfo?.dash as
        | {
            flac?: { audio?: DashAudioStream } | null;
            dolby?: { audio?: DashAudioStream[] } | null;
          }
        | undefined;
      const flacAudio = dashExtra?.flac?.audio;
      const dolbyAudio = dashExtra?.dolby?.audio?.[0];
      const durl = (playInfo as { durl?: Array<{ url: string; backup_url?: string[] }> })?.durl;
      const audio =
        findById(AUDIO_QUALITY.HIGH) ||
        findById(AUDIO_QUALITY.MEDIUM) ||
        findById(AUDIO_QUALITY.LOW) ||
        audioList[0] ||
        flacAudio ||
        dolbyAudio;

      if (__DEV_LOG__) {
        console.debug(
          '[BILI-API] playInfo:',
          bvId,
          'audio_ids=',
          audioList.map((a) => a?.id),
          'has_flac=',
          Boolean(flacAudio),
          'has_dolby=',
          Boolean(dolbyAudio),
          'durl_count=',
          durl?.length ?? 0,
          'picked_id=',
          audio?.id,
          'has_base_url=',
          Boolean(audio?.base_url),
        );
      }

      cached.viewInfo = viewInfo as unknown as Record<string, unknown>;
      cached.playInfo = playInfo as unknown as Record<string, unknown>;
      // dash 拿不到时回落到 durl 第一项 url
      cached.playUrl = pickPlayableUrl(audio) || durl?.[0]?.url || '';
      cached.last_update = timeStampNow();

      if (__DEV_LOG__) {
        console.debug(
          '[BILI-API] fetchMusicUrl resolved:',
          bvId,
          'playUrl=',
          cached.playUrl ? cached.playUrl.slice(0, 80) + '...' : '<EMPTY>',
        );
      }

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
            if (__DEV_LOG__) console.debug('[BILI-API] doClickStat 失败:', e);
          });
      }, CLICK_STAT_DELAY_MS);

      return cached.playUrl;
    } catch (e) {
      if (__DEV_LOG__) console.debug('[BILI-API] fetchMusicUrl 失败:', bvId, e);
      return '';
    } finally {
      cached.loading = false;
      delete inflightRequests[bvId];
    }
  })();

  inflightRequests[bvId] = promise;
  return promise;
}

/**
 * 清除指定 bvid 的播放 URL 缓存（用于风控重试场景）。
 * 不传 bvid 则清空全部缓存与 inflight。
 */
export function invalidateMusicUrlCache(bvId?: string): void {
  if (bvId) {
    delete musicPlayUrlCache[bvId];
    delete inflightRequests[bvId];
    return;
  }
  Object.keys(musicPlayUrlCache).forEach((k) => delete musicPlayUrlCache[k]);
  Object.keys(inflightRequests).forEach((k) => delete inflightRequests[k]);
}
