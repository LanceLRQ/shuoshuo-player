import { VideoApi } from '../api';
import { AUDIO_QUALITY, CLICK_STAT_THROTTLE, CLICK_STAT_DELAY_MS } from '../constants';
import { getPlatformBridge } from '../platform';
import { useRiskControlStore } from '../store/risk-control';
import { useMusicUrlCacheStore } from '../store/music-url-cache';
import { useBilibiliVideosStore } from '../store/bilibili-videos';
import { timeStampNow } from './format';
import type { DashAudioStream } from '../types';
import type { VideoViewInfo } from '../api/bilibili/video';

/**
 * 应用平台特定的音频 URL 转换（仅 Tauri 端实现 bili-stream://* 包装）
 *
 * 缓存中始终保存原始 URL；包装在每次 return 时应用，避免缓存失效后还原困难。
 * bridge 未初始化（测试环境）时静默回落原 URL，不抛错。
 */
function applyAudioUrlTransformer(url: string): string {
  if (!url) return url;
  try {
    const transformer = getPlatformBridge().audioUrlTransformer;
    return transformer ? transformer(url) : url;
  } catch {
    return url;
  }
}

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
 * 从已知来源解析 cid，避免 fetchMusicUrl 中重复调 view 接口
 *
 * 优先级：
 * 1. URL 缓存中已存的 cid（上次成功 fetch 时回填）
 * 2. bili_videos store 中 view 模式入库的视频 entity（mapViewItem 拾取的 cid）
 *
 * 取不到（如收藏夹来源 / 历史数据）则返回 undefined，调用方需 fallback 到 view 接口
 */
function resolveCachedCid(bvid: string): number | undefined {
  const fromUrlCache = useMusicUrlCacheStore.getState().entries[bvid]?.cid;
  if (typeof fromUrlCache === 'number' && fromUrlCache > 0) return fromUrlCache;
  const fromVideoStore = useBilibiliVideosStore.getState().entities[bvid]?.cid;
  if (typeof fromVideoStore === 'number' && fromVideoStore > 0) return fromVideoStore;
  return undefined;
}

/**
 * 获取 B 站视频音频流 URL（含缓存 / 音质降级 / 模拟点击统计）
 *
 * 优化路径（相对 v1）：
 * 1. URL 缓存升级为持久化 store（useMusicUrlCacheStore），TTL 内重启秒命中
 * 2. cid 已知（来自 URL 缓存或 view 模式入库）时跳过 view 接口调用
 * 3. 移除 v2 早期版本的 view→playurl jitter（反风控由 doClickStat 兜底已足够）
 * 4. 音质降级链：30280 (192K) → 30232 (132K) → 30216 (64K) → audioList[0]
 * 5. 成功后 500ms 延迟发起一次 doClickStat（同一视频 600s 节流）
 *
 * @param attempt 重试轮次：0=优先 HIGH；1=跳过 HIGH 选 MEDIUM；2=跳过 HIGH/MEDIUM 选 LOW；
 *                attempt > 0 时 bypass URL 缓存与 inflight 复用（已知上一档失败，需取新音质）。
 *                用于 onloaderror 触发的音质降级重试，Tauri 代理对部分老视频高码率档命中失败时兜底。
 */
export async function fetchMusicUrl(
  bvId: string,
  currentUserMid?: string | number,
  attempt: number = 0,
): Promise<string> {
  if (__DEV_LOG__) console.debug('[BILI-API] fetchMusicUrl enter:', bvId, 'attempt=', attempt);

  // attempt > 0：bypass 缓存 / inflight；下一档音质需要全新一次 playInfo 请求 + 重新选 audio.id
  const useSharedSlot = attempt === 0;

  if (useSharedSlot) {
    // 命中已有 inflight 请求：所有并发调用共享同一个 Promise，避免 race
    const existing = inflightRequests[bvId];
    if (existing) {
      if (__DEV_LOG__) console.debug('[BILI-API] fetchMusicUrl inflight hit:', bvId);
      return existing;
    }

    // 命中 TTL 内的持久化 URL 缓存：直接 return（重启后同样有效）
    const urlCacheStore = useMusicUrlCacheStore.getState();
    const cachedEntry = urlCacheStore.getValid(bvId);
    if (cachedEntry?.playUrl) {
      if (__DEV_LOG__) {
        console.debug(
          '[BILI-API] fetchMusicUrl cache hit:',
          bvId,
          'playUrl=',
          cachedEntry.playUrl.slice(0, 80) + '...',
        );
      }
      return applyAudioUrlTransformer(cachedEntry.playUrl);
    }
  }

  const promise = (async () => {
    try {
      // 优先从已知来源拿 cid（URL 缓存 / bili_videos store），命中则跳过 view 接口
      let cid = resolveCachedCid(bvId);
      let aid: number | undefined;
      let descType: string | number | undefined;

      if (typeof cid !== 'number') {
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

        cid = viewInfo?.cid ?? 0;
        aid = viewInfo?.aid;
        descType = viewInfo?.desc_v2?.[0]?.type;
      } else if (__DEV_LOG__) {
        console.debug('[BILI-API] fetchMusicUrl cid hit (skip view):', bvId, 'cid=', cid);
      }

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

      // 按 attempt 决定候选音质优先级：升一级即跳过更高一档（用于 onloaderror 后强制走低码率）
      // attempt=0: HIGH → MEDIUM → LOW
      // attempt=1: MEDIUM → LOW
      // attempt=2: LOW
      // 任何 attempt 在标准三档都失配时再回退到 audioList[0] / flacAudio / dolbyAudio（典型场景：
      // 视频只有非标准码率 audio_id；attempt=0 的回退能给出与原行为一致的兜底 URL）
      const orderedIds: number[] = [];
      if (attempt <= 0) orderedIds.push(AUDIO_QUALITY.HIGH);
      if (attempt <= 1) orderedIds.push(AUDIO_QUALITY.MEDIUM);
      if (attempt <= 2) orderedIds.push(AUDIO_QUALITY.LOW);
      let audio: DashAudioStream | undefined;
      for (const id of orderedIds) {
        const hit = findById(id);
        if (hit) {
          audio = hit;
          break;
        }
      }
      if (!audio) {
        audio = audioList[0] || flacAudio || dolbyAudio;
      }

      if (__DEV_LOG__) {
        console.debug(
          '[BILI-API] playInfo:',
          bvId,
          'attempt=',
          attempt,
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

      // dash 拿不到时回落到 durl 第一项 url
      const playUrl = pickPlayableUrl(audio) || durl?.[0]?.url || '';

      // 写入持久化 URL 缓存：携带 cid 以便重启 / TTL 过期后下次仍可跳过 view
      if (playUrl) {
        useMusicUrlCacheStore.getState().upsert(bvId, { playUrl, cid });
      }

      if (__DEV_LOG__) {
        console.debug(
          '[BILI-API] fetchMusicUrl resolved:',
          bvId,
          'playUrl=',
          playUrl ? playUrl.slice(0, 80) + '...' : '<EMPTY>',
        );
      }

      // 异步发起模拟点击（节流 600s）。aid / type 在 cid 命中跳过 view 时不可知，
      // 此时以 0 / '1' 兜底（B 站接口允许 aid=0 但点击成功率低，可接受）
      setTimeout(() => {
        const now = timeStampNow();
        if ((musicPlayClickTime[bvId] ?? 0) + CLICK_STAT_THROTTLE > now) return;
        const type = descType ?? '1';
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
            cid,
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

      return applyAudioUrlTransformer(playUrl);
    } catch (e) {
      if (__DEV_LOG__)
        console.debug('[BILI-API] fetchMusicUrl 失败:', bvId, 'attempt=', attempt, e);
      return '';
    } finally {
      // attempt > 0 没有写入 inflight slot，跳过 delete 避免误删 attempt=0 的并发请求
      if (useSharedSlot) delete inflightRequests[bvId];
    }
  })();

  if (useSharedSlot) inflightRequests[bvId] = promise;
  return promise;
}

/**
 * 清除指定 bvid 的播放 URL 缓存（用于风控重试场景）。
 * 不传 bvid 则清空全部缓存与 inflight。
 */
export function invalidateMusicUrlCache(bvId?: string): void {
  useMusicUrlCacheStore.getState().invalidate(bvId);
  if (bvId) {
    delete inflightRequests[bvId];
    return;
  }
  Object.keys(inflightRequests).forEach((k) => delete inflightRequests[k]);
}
