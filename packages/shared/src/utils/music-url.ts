import { VideoApi } from '../api';
import { AUDIO_QUALITY, BILI_FNVAL, CLICK_STAT_THROTTLE, CLICK_STAT_DELAY_MS } from '../constants';
import { getPlatformBridge } from '../platform';
import { useRiskControlStore } from '../store/risk-control';
import { useMusicUrlCacheStore } from '../store/music-url-cache';
import { useBilibiliVideosStore } from '../store/bilibili-videos';
import { usePlayerProfileStore } from '../store/player-profile';
import { pickVideosFields } from './bilibili';
import { timeStampNow } from './format';
import { logger } from './logger';
import { buildTrackId } from './track-id';
import type { AudioQualityPreference, DashAudioStream } from '../types';
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
 * 同 (bvid, page) 并发请求复用同一个 Promise（避免 React strict mode useEffect 双触发或
 * 上下游 effect 重复调用时，第二次抢到 cached.loading=true 后早返回 '' → goNext 误跳下一首）
 */
const inflightRequests: Record<string, Promise<string>> = {};

/**
 * 同 bvid 的 view 接口并发去重（不分 P）：
 * 同 bvid 不同 P 的并发 fetchMusicUrl 在 view 仍进行中时共享同一个 Promise，
 * 避免 view 被双调；首次完成后 pages 已入库，后续 P 通过 resolveCachedCid 命中 store。
 */
const viewInflightByBvid: Record<string, Promise<unknown>> = {};

function coalesceViewCall(bvId: string): Promise<unknown> {
  const existing = viewInflightByBvid[bvId];
  if (existing) return existing;
  const p = (VideoApi.getVideoViewInfo({ params: { bvid: bvId } }) as Promise<unknown>).finally(
    () => {
      delete viewInflightByBvid[bvId];
    },
  );
  viewInflightByBvid[bvId] = p;
  return p;
}

/* ========== 错误分类（供调用方决定 toast 文案 / 是否风控对话框） ========== */

/** fetchMusicUrl 的错误种类 */
export type FetchMusicUrlErrorKind =
  /** axios timeout / ECONNABORTED / ERR_NETWORK / 5xx — 触发自动重试 */
  | 'network'
  /** v_voucher 风控 — 不重试（已有全局对话框引导用户去主站验证） */
  | 'risk-control'
  /** 4xx / 业务 code != 0 — 不重试（视频下架、需登录、参数错） */
  | 'business'
  /** dash.audio + flac + dolby + durl 全空 — 不重试（视频本身没音频流） */
  | 'video-source-empty';

/** fetchMusicUrl 失败时透出的结构化错误 */
export interface FetchMusicUrlError {
  kind: FetchMusicUrlErrorKind;
  /** 给用户看的简短描述（toast 取用） */
  message: string;
  bvid: string;
  /** 音质降级 attempt（0=HIGH / 1=MEDIUM / 2=LOW） */
  attempt: number;
  /** 网络层已重试次数（最大 NETWORK_RETRY_MAX） */
  retryCount: number;
  /** 原始错误对象（调试用，调用方一般不需要） */
  rawError?: unknown;
}

/** fetchMusicUrl 选项：让调用方感知重试进度 / 最终错误 */
export interface FetchMusicUrlOptions {
  /** 每次重试前调用一次（retryCount 从 1 开始） */
  onRetry?: (info: {
    retryCount: number;
    maxRetries: number;
    lastError: FetchMusicUrlError;
  }) => void;
  /** 最终失败（耗尽重试 / 非重试错误）时调用一次 */
  onFinalError?: (error: FetchMusicUrlError) => void;
}

/** 网络层重试上限（首次失败后最多额外重试 N 次） */
const NETWORK_RETRY_MAX = 2;
/** 重试 backoff（毫秒），retry 1 用 [0]，retry 2 用 [1] */
const NETWORK_RETRY_BACKOFF_MS = [500, 1500];

/** v_voucher 风控错误的内部标记字段（用于 classifyError 区分） */
const RISK_CONTROL_MARKER = '__isRiskControl';

/** 创建带风控标记的 Error（throw 后 catch 内 classifyError 能识别） */
function createRiskControlError(voucher: string): Error {
  const err = new Error(`B 站风控（v_voucher）：${voucher.slice(0, 32)}`);
  (err as Error & { [RISK_CONTROL_MARKER]?: boolean })[RISK_CONTROL_MARKER] = true;
  return err;
}

/**
 * 把 catch 到的任意错误归类为 FetchMusicUrlError
 *
 * 判定顺序（重要：避免误归类）：
 * 1. 风控标记 → risk-control
 * 2. axios error（含 isAxiosError / config 字段）→ 看 status
 *    - 5xx / 无 response（DNS / timeout / connect）→ network（重试）
 *    - 4xx → business（不重试）
 * 3. buildBilibiliApiCall 抛的 respData（有 code 字段，code != 0）→ business
 * 4. 其他 → business（保守，不无限重试）
 */
function classifyError(
  e: unknown,
  bvid: string,
  attempt: number,
  retryCount: number,
): FetchMusicUrlError {
  // 1. 风控
  if (
    e &&
    typeof e === 'object' &&
    (e as { [RISK_CONTROL_MARKER]?: boolean })[RISK_CONTROL_MARKER]
  ) {
    return {
      kind: 'risk-control',
      message: (e as Error).message ?? 'B 站风控',
      bvid,
      attempt,
      retryCount,
      rawError: e,
    };
  }
  // 2. axios error
  const eAny = e as {
    isAxiosError?: boolean;
    config?: unknown;
    response?: { status?: number; data?: unknown };
    message?: string;
    code?: string | number;
  } | null;
  if (eAny?.isAxiosError || eAny?.config) {
    const status = eAny.response?.status;
    if (typeof status === 'number') {
      if (status >= 500) {
        return {
          kind: 'network',
          message: `B 站接口 HTTP ${status}`,
          bvid,
          attempt,
          retryCount,
          rawError: e,
        };
      }
      return {
        kind: 'business',
        message: `B 站接口拒绝 HTTP ${status}`,
        bvid,
        attempt,
        retryCount,
        rawError: e,
      };
    }
    // 没拿到 response：DNS / connect / TLS / timeout 都归到 network
    return {
      kind: 'network',
      message: eAny.message ?? '网络异常（无响应）',
      bvid,
      attempt,
      retryCount,
      rawError: e,
    };
  }
  // 3. buildBilibiliApiCall throw 的 respData（业务 code != 0）
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: number; message?: string }).code;
    const msg = (e as { message?: string }).message ?? '';
    return {
      kind: 'business',
      message: `B 站业务错误 code=${code}${msg ? `, ${msg}` : ''}`,
      bvid,
      attempt,
      retryCount,
      rawError: e,
    };
  }
  // 4. fallback
  return {
    kind: 'business',
    message:
      typeof eAny?.message === 'string' ? eAny.message : typeof e === 'string' ? e : '未知错误',
    bvid,
    attempt,
    retryCount,
    rawError: e,
  };
}

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
 * 按「音质偏好 × 降级轮次」生成候选音质 id 优先级列表（命中第一个可用即用）。
 *
 * - attempt=0：按用户偏好起档，找不到逐级降到更低档（高保真档拿不到自动回落常规）
 * - attempt>=1：onloaderror 降级重试，强制跳过高保真，只在常规中低档找（高保真加载失败多为流问题）
 */
function resolveOrderedQualityIds(preference: AudioQualityPreference, attempt: number): number[] {
  const { HIRES, DOLBY, HIGH, MEDIUM, LOW } = AUDIO_QUALITY;
  if (attempt >= 2) return [LOW];
  if (attempt === 1) return [MEDIUM, LOW];
  switch (preference) {
    case 'auto':
    case 'hires':
      return [HIRES, DOLBY, HIGH, MEDIUM, LOW];
    case 'dolby':
      return [DOLBY, HIGH, MEDIUM, LOW];
    case 'high':
      return [HIGH, MEDIUM, LOW];
    case 'medium':
      return [MEDIUM, LOW];
    case 'low':
      return [LOW];
    default:
      return [HIGH, MEDIUM, LOW];
  }
}

/** 高保真偏好需 fnval=4048 才能让接口返回 dash.flac/dolby；常规档只要 DASH=16 */
function isHiFiPreference(preference: AudioQualityPreference): boolean {
  return preference === 'auto' || preference === 'hires' || preference === 'dolby';
}

/**
 * 从 bili_videos store 解析指定 page 的 cid，避免 fetchMusicUrl 中重复调 view 接口
 *
 * 自 A5 起 URL 缓存 key 升级为 `bvid:cid`，缓存不再独立保存 cid；
 * 因此 cid 解析的唯一来源是 bili_videos store 中 view 模式入库的视频 entity。
 *
 * 优先级（B1 起按 page 解析）：
 * 1. entity.pages[page-1].cid（A4 之后 view 接口已回填完整 pages）
 * 2. entity.cid（仅 page=1 时使用 — 是 1P 的便捷字段）
 *
 * 取不到（如收藏夹来源 / 历史数据 / 跨 P 但 pages 未入库）则返回 undefined，
 * 调用方需 fallback 到 view 接口。
 */
function resolveCachedCid(bvid: string, page: number = 1): number | undefined {
  const entity = useBilibiliVideosStore.getState().entities[bvid];
  if (!entity) return undefined;
  const pageEntry = entity.pages?.[page - 1];
  if (pageEntry && typeof pageEntry.cid === 'number' && pageEntry.cid > 0) {
    return pageEntry.cid;
  }
  // 仅 page=1 可以 fallback 到 entity.cid（顶层 cid 是 1P 的 cid）
  if (page === 1 && typeof entity.cid === 'number' && entity.cid > 0) {
    return entity.cid;
  }
  return undefined;
}

/**
 * 单次取流尝试：成功返回 { url: string }（''表示视频源为空）；失败返回 { error }
 *
 * 不含重试 / inflight / 缓存逻辑（由外层封装）。
 */
async function attemptFetchMusicUrl(
  bvId: string,
  currentUserMid: string | number | undefined,
  attempt: number,
  retryCount: number,
  page: number,
): Promise<
  | { url: string; cid: number; aid?: number; descType?: string | number }
  | { error: FetchMusicUrlError }
> {
  try {
    // 优先从 bili_videos store 拿指定 page 的 cid，命中则跳过 view 接口
    let cid = resolveCachedCid(bvId, page);
    let aid: number | undefined;
    let descType: string | number | undefined;

    if (typeof cid !== 'number') {
      // 同 bvid 不同 P 并发：若第一次 view 仍在进行，复用其 Promise 避免 view 被双调；
      // 首次完成后 pages 已入库，等后的请求通过 resolveCachedCid 命中 store。
      const viewInfo = (await coalesceViewCall(bvId)) as VideoViewInfo & {
        cid?: number;
        aid?: number;
        pages?: Array<{ cid: number; page: number }>;
      };

      logger.debug('[BILI-API]', 'viewInfo ok', {
        bvid: bvId,
        cid: viewInfo?.cid,
        aid: viewInfo?.aid,
        videos: (viewInfo as { videos?: number })?.videos,
        requestPage: page,
      });

      aid = viewInfo?.aid;
      descType = viewInfo?.desc_v2?.[0]?.type;

      // 回填 pages/videos 到 bili_videos store：后续切 P 直接拿 cid，省 view 调用。
      // 强制用请求 bvId 作为 entity key（覆盖 viewInfo.bvid），生产场景两者一致；
      // 接口异常或 mock 不一致时也能保证入库到正确位置。
      if (viewInfo && (typeof viewInfo.cid === 'number' || Array.isArray(viewInfo.pages))) {
        useBilibiliVideosStore
          .getState()
          .upsertMany(
            pickVideosFields({ ...viewInfo, bvid: bvId } as unknown as { bvid: string }, 'view'),
          );
      }

      // 取目标 page 的 cid：优先 viewInfo.pages、回退 entity 已入库的 pages、再回退顶层 cid
      const pickedFromPages =
        viewInfo?.pages?.find((p) => p.page === page)?.cid ?? resolveCachedCid(bvId, page);
      if (typeof pickedFromPages === 'number') {
        cid = pickedFromPages;
      } else if (page === 1) {
        cid = viewInfo?.cid ?? 0;
      } else {
        cid = 0;
      }
    } else {
      logger.debug('[BILI-API]', 'fetchMusicUrl cid hit (skip view)', { bvid: bvId, cid, page });
    }

    // 高保真偏好（auto/hires/dolby）需 fnval=4048 才返回 dash.flac/dolby；
    // 常规档与降级重试（attempt>0）只要 DASH=16，减小风控面、加快返回。
    const preference = usePlayerProfileStore.getState().defaultAudioQuality;
    const fnval =
      attempt === 0 && isHiFiPreference(preference) ? BILI_FNVAL.DASH_ALL : BILI_FNVAL.DASH;

    const playInfo = await VideoApi.getVideoPlayurl({
      params: { cid, fnval, bvid: bvId },
    });

    // 风控检测：B 站对异常 wbi 签名 / 缺 Cookie / 频繁请求会返回 code=0 但 data 只含
    // v_voucher（详见 docs/misc/sign/v_voucher.md）。触发全局风控对话框引导用户主站验证。
    const voucher = (playInfo as { v_voucher?: string } | undefined)?.v_voucher;
    if (voucher) {
      logger.warn('[BILI-API]', 'playurl v_voucher 风控', {
        bvid: bvId,
        voucher: voucher.slice(0, 32),
      });
      useRiskControlStore.getState().openRiskControl(voucher, bvId);
      throw createRiskControlError(voucher);
    }

    // 统一音频流池：常规 dash.audio + 杜比 dash.dolby.audio + Hi-Res dash.flac.audio
    const audioList = playInfo?.dash?.audio ?? [];
    const dolbyAudioList = playInfo?.dash?.dolby?.audio ?? [];
    const flacAudio = playInfo?.dash?.flac?.audio ?? undefined;
    const allAudio: DashAudioStream[] = [
      ...audioList,
      ...dolbyAudioList,
      ...(flacAudio ? [flacAudio] : []),
    ];
    const findById = (id: number): DashAudioStream | undefined =>
      allAudio.find((a) => a?.id === id);
    const durl = playInfo?.durl;

    // 按「偏好 × attempt」选目标音质，命中第一个即用，全不命中回落流池首项
    const orderedIds = resolveOrderedQualityIds(preference, attempt);
    let audio: DashAudioStream | undefined;
    for (const id of orderedIds) {
      const hit = findById(id);
      if (hit) {
        audio = hit;
        break;
      }
    }
    if (!audio) {
      audio = allAudio[0];
    }

    logger.debug('[BILI-API]', 'playInfo parsed', {
      bvid: bvId,
      attempt,
      preference,
      fnval,
      audio_ids: allAudio.map((a) => a?.id),
      has_flac: Boolean(flacAudio),
      has_dolby: dolbyAudioList.length > 0,
      durl_count: durl?.length ?? 0,
      picked_id: audio?.id,
      has_base_url: Boolean(audio?.base_url),
    });

    // dash 拿不到时回落到 durl 第一项 url
    const playUrl = pickPlayableUrl(audio) || durl?.[0]?.url || '';

    return { url: playUrl, cid, aid, descType };
  } catch (e) {
    return { error: classifyError(e, bvId, attempt, retryCount) };
  }
}

/**
 * 获取 B 站视频音频流 URL（含缓存 / 音质降级 / 模拟点击统计 / 网络层自动重试）
 *
 * 优化路径（相对 v1 / 历史 v2）：
 * 1. URL 缓存升级为持久化 store（useMusicUrlCacheStore），TTL 内重启秒命中
 * 2. cid 已知（来自 URL 缓存或 view 模式入库）时跳过 view 接口调用
 * 3. 音质降级链：30280 (192K) → 30232 (132K) → 30216 (64K) → audioList[0]
 * 4. 成功后 500ms 延迟发起一次 doClickStat（同一视频 600s 节流）
 * 5. **网络层自动重试**：DNS / timeout / 5xx 触发，最多 NETWORK_RETRY_MAX 次，
 *    backoff 500 / 1500ms；风控 / 4xx / 视频源问题不重试
 *
 * @param attempt 音质降级轮次（与网络重试 retryCount 是两个独立维度）：
 *   - 0=优先 HIGH，写入并复用 inflight + URL 缓存
 *   - 1=跳过 HIGH 选 MEDIUM；bypass 缓存与 inflight
 *   - 2=跳过 HIGH/MEDIUM 选 LOW；bypass 缓存与 inflight
 * @param options 重试 / 最终失败回调（让 UI 层显示进度与分类文案）
 */
export async function fetchMusicUrl(
  bvId: string,
  currentUserMid?: string | number,
  attempt: number = 0,
  options?: FetchMusicUrlOptions,
  page?: number,
): Promise<string> {
  // 防御：page 必须为 >= 1 的整数，否则 fallback 到 1（不抛错以简化调用方）
  const effectivePage = typeof page === 'number' && Number.isInteger(page) && page >= 1 ? page : 1;

  logger.debug('[BILI-API]', 'fetchMusicUrl enter', { bvid: bvId, attempt, page: effectivePage });

  // attempt > 0：bypass 缓存 / inflight；下一档音质需要全新一次 playInfo 请求 + 重新选 audio.id
  const useSharedSlot = attempt === 0;
  // inflight slot key：bvid + page。同一 bvid 的不同 P 是独立请求，不能复用 promise。
  // 复用 TrackId 工具构造，避免分散硬编码 `:p` 字面量
  const inflightKey = buildTrackId(bvId, effectivePage);

  if (useSharedSlot) {
    // 命中已有 inflight 请求：相同 (bvid, page) 的并发调用共享 Promise，避免 race
    const existing = inflightRequests[inflightKey];
    if (existing) {
      logger.debug('[BILI-API]', 'fetchMusicUrl inflight hit', { bvid: bvId, page: effectivePage });
      return existing;
    }

    // 命中 TTL 内的持久化 URL 缓存：直接 return（重启后同样有效）。
    // 自 A5 起 cache key 升级为 `bvid:cid`，需先从 bili_videos store 拿到 cid 才能查；
    // 拿不到（首次播放）时跳过 cache 直接走 attemptFetchMusicUrl 内部 view → upsert 流程。
    const knownCid = resolveCachedCid(bvId, effectivePage);
    if (typeof knownCid === 'number') {
      const cachedEntry = useMusicUrlCacheStore.getState().getValid(bvId, knownCid);
      if (cachedEntry?.playUrl) {
        logger.debug('[BILI-API]', 'fetchMusicUrl cache hit', {
          bvid: bvId,
          cid: knownCid,
          page: effectivePage,
          playUrl: cachedEntry.playUrl.slice(0, 80) + '...',
        });
        return applyAudioUrlTransformer(cachedEntry.playUrl);
      }
    }
  }

  const promise = (async () => {
    try {
      let lastError: FetchMusicUrlError | undefined;
      // 网络层重试循环：首次尝试 retryCount=0，最多额外 NETWORK_RETRY_MAX 次
      for (let retryCount = 0; retryCount <= NETWORK_RETRY_MAX; retryCount++) {
        if (retryCount > 0) {
          const backoff = NETWORK_RETRY_BACKOFF_MS[retryCount - 1] ?? 1500;
          logger.info('[BILI-API]', 'fetchMusicUrl retrying', {
            bvid: bvId,
            retryCount,
            maxRetries: NETWORK_RETRY_MAX,
            backoff,
            lastErrorKind: lastError?.kind,
          });
          options?.onRetry?.({
            retryCount,
            maxRetries: NETWORK_RETRY_MAX,
            lastError: lastError!,
          });
          await new Promise<void>((r) => setTimeout(r, backoff));
        }

        const result = await attemptFetchMusicUrl(
          bvId,
          currentUserMid,
          attempt,
          retryCount,
          effectivePage,
        );
        if ('error' in result) {
          lastError = result.error;
          logger.warn('[BILI-API]', 'fetchMusicUrl attempt failed', {
            bvid: bvId,
            attempt,
            retryCount,
            errKind: lastError.kind,
            errMessage: lastError.message,
          });
          // 仅 network 错误重试；其他错误立即终止
          if (lastError.kind !== 'network') {
            options?.onFinalError?.(lastError);
            return '';
          }
          continue;
        }

        // 成功路径
        const { url: playUrl, cid, aid, descType } = result;

        // 视频源为空（dash + durl 全空）：不重试，直接报 video-source-empty
        if (!playUrl) {
          const err: FetchMusicUrlError = {
            kind: 'video-source-empty',
            message: '视频无可用音频流',
            bvid: bvId,
            attempt,
            retryCount,
          };
          logger.warn('[BILI-API]', 'fetchMusicUrl empty source', { bvid: bvId, attempt });
          options?.onFinalError?.(err);
          return '';
        }

        // 写入持久化 URL 缓存：key = `${bvId}:${cid}`，重启 / TTL 内可秒命中。
        // cid 信息由 view 接口入库到 bili_videos store（resolveCachedCid 下次直接拿到）
        useMusicUrlCacheStore.getState().upsert(bvId, cid, { playUrl });

        logger.debug('[BILI-API]', 'fetchMusicUrl resolved', {
          bvid: bvId,
          retryCount,
          playUrl: playUrl.slice(0, 80) + '...',
        });

        // 异步发起模拟点击（节流 600s，按 bvid:page 分桶）。
        // aid / type 在 cid 命中跳过 view 时不可知，以 0 / '1' 兜底。
        const clickKey = inflightKey;
        setTimeout(() => {
          const now = timeStampNow();
          if ((musicPlayClickTime[clickKey] ?? 0) + CLICK_STAT_THROTTLE > now) return;
          const type = descType ?? '1';
          VideoApi.doClickStat({
            params: {
              w_aid: aid,
              w_part: effectivePage,
              w_ftime: now,
              w_stime: now,
              w_type: type,
            },
            data: {
              aid,
              cid,
              bvid: bvId,
              part: String(effectivePage),
              ftime: now,
              stime: now,
              mid: currentUserMid,
              type,
              sub_type: '0',
            },
          })
            .then(() => {
              musicPlayClickTime[clickKey] = timeStampNow();
            })
            .catch((e) => {
              logger.debug('[BILI-API]', 'doClickStat failed', e);
            });
        }, CLICK_STAT_DELAY_MS);

        return applyAudioUrlTransformer(playUrl);
      }

      // 耗尽所有 network 重试仍失败
      if (lastError) {
        logger.error('[BILI-API]', 'fetchMusicUrl exhausted retries', {
          bvid: bvId,
          attempt,
          retryCount: lastError.retryCount,
          errKind: lastError.kind,
        });
        options?.onFinalError?.(lastError);
      }
      return '';
    } finally {
      // attempt > 0 没有写入 inflight slot，跳过 delete 避免误删 attempt=0 的并发请求
      if (useSharedSlot) delete inflightRequests[inflightKey];
    }
  })();

  if (useSharedSlot) inflightRequests[inflightKey] = promise;
  return promise;
}

/**
 * 清除指定 bvid 的播放 URL 缓存与 inflight（用于风控重试场景）。
 * 不传 bvid 则清空全部缓存与 inflight。
 *
 * 多 P 投稿：清空该 bvid 下所有 P 的缓存与 inflight slot（前缀匹配 `${bvid}:p`）。
 */
export function invalidateMusicUrlCache(bvId?: string): void {
  useMusicUrlCacheStore.getState().invalidate(bvId);
  if (bvId) {
    // inflightKey 形如 bvid 或 bvid:p<n>（见 buildTrackId）。前缀匹配清掉所有 P 的 slot。
    for (const key of Object.keys(inflightRequests)) {
      if (key === bvId || key.startsWith(`${bvId}:`)) delete inflightRequests[key];
    }
    return;
  }
  Object.keys(inflightRequests).forEach((k) => delete inflightRequests[k]);
}
