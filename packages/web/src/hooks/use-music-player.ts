import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import {
  useBilibiliUserStore,
  useBilibiliVideosStore,
  usePlayingListStore,
  usePlayerProfileStore,
  useLyricsStore,
  useUIStore,
  useVideoPagePrefStore,
  fetchMusicUrl,
  invalidateMusicUrlCache,
  parseTrackId,
  buildTrackId,
  urlPrefixFixed,
  LyricApi,
  NoticeType,
  parseLRC,
  createLyricsFinder,
  type BilibiliVideo,
  type FetchMusicUrlError,
  type LoopMode,
} from '@shuoshuo-player/shared';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { useUIShell } from '@/stores/ui-shell';

interface PlayerState {
  isLoading: boolean;
  isPlaying: boolean;
  isPausing: boolean;
  progress: number;
  duration: number;
  /** 当前曲目（playing-list.current 对应的 BilibiliVideo） */
  currentVideo: BilibiliVideo | null;
  /** 渲染歌词文本（已应用 offset 后的当前行） */
  currentLyricLine: string;
}

interface PlayerControls {
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  cycleLoopMode: () => void;
}

/**
 * 音乐播放核心 Hook
 *
 * 封装 Howler 实例 + 8 回调状态机 + 自动取歌词 + 播放进度循环。
 * 与 v1 splayer/index.js 行为对齐，并补完 onload/onloaderror/onstop/onseek/onplayerror。
 *
 * playNext 信号清除时机：
 * - initHowl 完成（onplay 首次触发）后清除
 * - currentVideo 变 null（被从队列中删除）时调用 stop + clearPlayNext
 *
 * 错误降级：fetchMusicUrl / onloaderror 失败时**直接停在当前曲目**（不再自动跳下一首）。
 * 接口故障 / 风控 / 单 BV 失效都视为停止信号，避免快速跑空整个队列；用户手动切歌即可。
 * 歌词加载完全独立于音频流，失败仅显示"暂无歌词"，不影响播放、不触发跳转。
 */
/**
 * 音质降级最大重试次数：
 * 0=HIGH(192K) → 1=MEDIUM(132K) → 2=LOW(64K)，三次尝试覆盖全部 dash 标准音质档。
 * 与 fetchMusicUrl 内 attempt 的语义一一对应；任何 attempt 升到 MAX 仍 onloaderror 即放弃。
 */
const AUDIO_FALLBACK_MAX_ATTEMPT = 2;

/**
 * 出错探测：fetch 一次目标 URL 的 0-1023 字节，把 status / 关键 header / body 前 256B
 * 输出到 webview 控制台，方便定位 Tauri Rust 代理的真实失败原因。
 *
 * 仅 onloaderror 触发；正常播放路径无开销。Windows WebView2 下自定义协议被映射为
 * http://bili-stream.localhost/，fetch 可正常工作；macOS/Linux 走 bili-stream:// 原生 scheme。
 */
/**
 * 把 fetchMusicUrl 的结构化错误转为用户友好的 toast 文案
 *
 * - network: 鼓励用户重试 / 检查网络（已在 logger 中记录详细诊断）
 * - business: 暴露 B 站接口返回的 code / status，引导用户判断是否需登录或视频已下架
 * - video-source-empty: 明确告知该视频无可用音频流
 * - risk-control: 不应走到此分支（onFinalError 已 early return）
 */
function buildFetchMusicUrlErrorToast(err: FetchMusicUrlError): string {
  switch (err.kind) {
    case 'network':
      return `网络异常，无法获取音频地址（已重试 ${err.retryCount} 次）：${err.message}。请检查 DNS / VPN 或稍后再试`;
    case 'business':
      return `B 站接口拒绝：${err.message.slice(0, 80)}。可能视频已下架或需重新登录`;
    case 'video-source-empty':
      return `视频 ${err.bvid} 无可用音频流`;
    case 'risk-control':
      return `B 站风控未通过，请按对话框提示完成主站验证后切歌`;
    default:
      return `获取音频地址失败：${err.bvid}（${err.message.slice(0, 80)}）`;
  }
}

async function probeAudioUrl(url: string, bvid: string): Promise<void> {
  if (!__DEV_LOG__ || !url) return;
  try {
    const resp = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    const headerEntries: Record<string, string> = {};
    resp.headers.forEach((v, k) => {
      headerEntries[k] = v;
    });
    let bodyPreview = '';
    if (resp.status >= 400) {
      try {
        bodyPreview = (await resp.text()).slice(0, 256);
      } catch {
        bodyPreview = '<read body failed>';
      }
    }
    console.debug('[BILI-API] proxy probe:', bvid, {
      status: resp.status,
      statusText: resp.statusText,
      headers: headerEntries,
      bodyPreview: bodyPreview || '<2xx, body omitted>',
    });
  } catch (e) {
    console.debug('[BILI-API] proxy probe failed:', bvid, e);
  }
}

/** 循环模式轮换顺序：播放器循环按钮逐次点击切换 */
const LOOP_MODE_CYCLE: LoopMode[] = ['loop', 'random', 'single', 'once'];

export function useMusicPlayer(): PlayerState & PlayerControls {
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
  // 按 TrackId（bvid 或 bvid:p<n>）比对，避免同 bvid 切 P 时不清 playNext
  const lastClearedTrackRef = useRef<string>('');
  // mediaSession.setPositionState 用 ref 读最新进度，避免高频 setProgress 让 effect 反复重建定时器
  const progressRef = useRef(0);
  // initHowl 自递归（onloaderror 重试时调用最新版本 / handleEnd 分 P 连播调下一 P）通过 ref 解耦
  const initHowlRef = useRef<
    ((video: BilibiliVideo, page: number, attempt?: number) => Promise<void>) | null
  >(null);
  // onend 通过 ref 调最新 handleEnd：loopMode 变化会重建 handleEnd，但不会重建已在播放的 Howl，
  // 直接闭包捕获会让 onend 永远用创建实例那刻的旧 loopMode（设了单曲循环仍跳下一首的 stale bug）
  const handleEndRef = useRef<(() => void) | null>(null);
  // 并发哨兵：快速切歌时旧的 fetchMusicUrl 仍可能 resolve，凭 gen 比对丢弃所有 stale 路径
  const initGenRef = useRef(0);
  // 当前实际播放的 P（与 store.current 解耦：分 P 连播时只动 ref 不动 store，避免污染用户视角的 TrackId）
  const playingPageRef = useRef(1);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasLyricFetchTry, setHasLyricFetchTry] = useState(false);

  progressRef.current = progress;

  const biliMid = useBilibiliUserStore((s) => s.current?.mid);
  const currentTrackId = usePlayingListStore((s) => s.current);
  const playNext = usePlayingListStore((s) => s.playNext);
  const clearPlayNext = usePlayingListStore((s) => s.clearPlayNext);
  const updateCurrentPlaying = usePlayingListStore((s) => s.updateCurrentPlaying);
  const getNextIndex = usePlayingListStore((s) => s.getNextIndex);
  const getPrevIndex = usePlayingListStore((s) => s.getPrevIndex);

  // TrackId 解析：parsed 为 null 视为脏数据，回落到把整个 currentTrackId 当 bvid（兼容历史）
  const parsedTrack = useMemo(
    () => (currentTrackId ? parseTrackId(currentTrackId) : null),
    [currentTrackId],
  );
  const currentBvId = parsedTrack?.bvid ?? currentTrackId;
  const explicitPage = parsedTrack?.page;

  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const currentVideo = currentBvId ? (videoEntities[currentBvId] ?? null) : null;

  const volume = usePlayerProfileStore((s) => s.volume);
  const autoPlay = usePlayerProfileStore((s) => s.autoPlay);
  const loopMode = usePlayerProfileStore((s) => s.loopMode);
  const autoPlayNextPage = usePlayerProfileStore((s) => s.autoPlayNextPage);
  const setVolumeStore = usePlayerProfileStore((s) => s.setVolume);
  const setLoopMode = usePlayerProfileStore((s) => s.setLoopMode);

  const lyricMaps = useLyricsStore((s) => s.lyricMaps);
  const updateLyric = useLyricsStore((s) => s.updateLyric);

  const sendNotice = useUIStore((s) => s.sendNotice);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startRaf = useCallback(() => {
    stopRaf();
    const tick = () => {
      const howl = howlRef.current;
      if (howl && howl.playing()) {
        const cur = howl.seek();
        if (typeof cur === 'number') setProgress(cur);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf]);

  // 跳到下一首（基于 store 计算 next index）
  const goNext = useCallback(() => {
    const nextIdx = getNextIndex(loopMode);
    if (nextIdx >= 0) updateCurrentPlaying(nextIdx, true);
  }, [getNextIndex, loopMode, updateCurrentPlaying]);

  const goPrev = useCallback(() => {
    const prevIdx = getPrevIndex(loopMode);
    if (prevIdx >= 0) updateCurrentPlaying(prevIdx, true);
  }, [getPrevIndex, loopMode, updateCurrentPlaying]);

  const handleEnd = useCallback(() => {
    // 编辑歌词期间：曲终强制循环当前曲、不切歌，避免触发 LyricEditor 切曲重置丢失未保存编辑。
    // 用 getState() 即时读取（非订阅），不让编辑态切换重建 handleEnd / 触发播放核心重渲染。
    const isEditingLyric = useUIShell.getState().lyricEditing;
    if ((isEditingLyric || loopMode === 'single') && howlRef.current) {
      howlRef.current.seek(0);
      howlRef.current.play();
      return;
    }

    // 播完就停：当前曲目播完即停，不循环不切歌（stop 触发 onstop 复位 isPlaying/progress）。
    // 手动点上/下一首仍走 goNext/goPrev，不受此限制。
    if (loopMode === 'once' && howlRef.current) {
      howlRef.current.stop();
      return;
    }

    // 分 P 连播判定（B5）：满足全部条件才切下一 P，否则原 goNext()
    // 1. autoPlayNextPage=true（用户在设置中开启了实验性连播）
    // 2. 当前 TrackId 是纯 bvid（非显式 :p<n>，显式条目永远走 next）
    // 3. currentVideo 是多 P 投稿（videos > 1）
    // 4. 当前实际播放 P 未到末尾（playingPage < videos）
    const totalP = currentVideo?.videos ?? 1;
    const curP = playingPageRef.current;
    if (
      autoPlayNextPage &&
      explicitPage === undefined &&
      currentVideo &&
      totalP > 1 &&
      curP < totalP
    ) {
      void initHowlRef.current?.(currentVideo, curP + 1);
      return;
    }

    goNext();
  }, [loopMode, goNext, autoPlayNextPage, explicitPage, currentVideo]);

  // 初始化 Howl 实例
  const initHowl = useCallback(
    async (video: BilibiliVideo, page: number, attempt: number = 0) => {
      // 占用一个新 generation，作为本次调用的身份标识
      // 所有异步回调（await 后、Howl 构造、onload、onloaderror）都对照 gen，stale 路径直接丢弃
      const gen = ++initGenRef.current;
      // 同步更新"实际播放的 P"，供 onend 分 P 连播 / mediaSession 等使用
      playingPageRef.current = page;
      // 推送到 runtime store，让外部订阅方（如 PlayingQueue / SPlayer P 选择器）看到当前 P
      usePlayerRuntimeStore.setState({ playingPage: page });

      // 释放旧实例
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }
      stopRaf();
      setProgress(0);
      setDuration(0);
      setIsLoading(true);

      // mediaSession 元数据：MediaMetadata 在某些 WebView / jsdom 环境下未提供，做能力探测
      // 仅 attempt=0 时刷新（重试不需要重置元数据）。多 P 投稿在标题加 P 后缀，便于锁屏识别
      if (
        attempt === 0 &&
        'mediaSession' in navigator &&
        typeof MediaMetadata !== 'undefined' &&
        video.title
      ) {
        const isMultiPart = (video.videos ?? 1) > 1;
        const partTitle = isMultiPart ? video.pages?.[page - 1]?.part : undefined;
        const displayTitle = isMultiPart
          ? `${video.title}（P${page}${partTitle ? ` - ${partTitle}` : ''}）`
          : video.title;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: displayTitle,
          artist: video.author,
          artwork: video.pic ? [{ src: urlPrefixFixed(video.pic) }] : undefined,
        });
      }

      // 提取最终错误用于失败后分类 toast；onRetry 期间显示 INFO toast 反馈重试进度
      const url = await fetchMusicUrl(
        video.bvid,
        biliMid,
        attempt,
        {
          onRetry: ({ retryCount, maxRetries }) => {
            sendNotice({
              type: NoticeType.INFO,
              message: `B 站接口暂时不通，正在重试 (${retryCount}/${maxRetries})...`,
              duration: 2000,
            });
          },
          onFinalError: (err) => {
            // 风控已有全局对话框引导用户去主站验证，无需再弹 toast 避免双重提示
            if (err.kind === 'risk-control') return;
            sendNotice({
              type: NoticeType.ERROR,
              message: buildFetchMusicUrlErrorToast(err),
              duration: 6000,
            });
          },
        },
        page,
      );
      if (__DEV_LOG__) {
        console.debug(
          '[BILI-API] initHowl got url:',
          video.bvid,
          'attempt=',
          attempt,
          'url=',
          url || '<EMPTY>',
        );
      }
      // Stale 校验（最关键的拦截点）：await 期间用户已切歌，丢弃此次结果
      // 不调 setIsLoading(false)：新调用已接管 loading 状态，避免视觉跳动
      if (gen !== initGenRef.current) {
        if (__DEV_LOG__) {
          console.debug('[BILI-API] initHowl stale (post-fetch), drop:', video.bvid, 'gen=', gen);
        }
        return;
      }
      if (!url) {
        setIsLoading(false);
        // 解析失败直接停在当前曲目，不再自动跳下一首；toast 已由 onFinalError 发出
        return;
      }

      const howl = new Howl({
        src: [url],
        // B 站 dash 音频流是 .m4s（fragmented mp4 segment）容器，但 Howler 默认按文件后缀
        // 推断 codec，不识别 .m4s → 触发误报 onloaderror "No codec support"。
        // 显式指定 format 让 Howler 跳过后缀推断，按 mp4 解码（浏览器原生支持 audio/mp4）
        format: ['mp4'],
        html5: true,
        volume,
        onload: () => {
          // 该实例属于已过期的初始化（用户已切歌）→ 立即销毁，不调 play()
          if (gen !== initGenRef.current) {
            try {
              howl.stop();
              howl.unload();
            } catch {
              /* 忽略：unload 期间可能抛错，无害 */
            }
            return;
          }
          setIsLoading(false);
          setDuration(howl.duration());
          if (autoPlay) howl.play();
        },
        onloaderror: (id, err) => {
          // stale：用户已切歌，旧 Howl 的加载错误不应触发降级重试
          if (gen !== initGenRef.current) {
            try {
              howl.unload();
            } catch {
              /* 忽略 */
            }
            return;
          }
          // 取 howl 内部 audio element 的 MediaError 详情：err 仅是 howler 抽象数字（4=src not supported），
          // 真实失败原因由浏览器写在 audioEl.error.{code, message}
          let mediaErrInfo: { code: number; message: string } | null = null;
          let audioSrc = '';
          try {
            const sounds = (
              howl as Howl & {
                _sounds?: Array<{ _node?: HTMLAudioElement }>;
              }
            )._sounds;
            const audioEl = sounds?.[0]?._node;
            if (audioEl?.error) {
              mediaErrInfo = {
                code: audioEl.error.code,
                message: audioEl.error.message || '<empty>',
              };
            }
            audioSrc = audioEl?.currentSrc?.slice(0, 200) || '';
          } catch {
            /* ignore: 能力探测失败不影响主流程 */
          }
          if (__DEV_LOG__) {
            console.debug(
              '[BILI-API] howl onloaderror:',
              video.bvid,
              'attempt=',
              attempt,
              'soundId=',
              id,
              'howlErr=',
              err,
              'mediaError=',
              mediaErrInfo,
              'audioSrc=',
              audioSrc,
            );
          }
          // 异步探测代理 URL 真实响应（不 await，避免阻塞重试链路）
          void probeAudioUrl(url, video.bvid);

          // 失效该 BV 的 URL 缓存，避免重启 / 再次播放仍命中失败的高码率 URL
          invalidateMusicUrlCache(video.bvid);

          // 音质降级重试：升一档继续尝试，封顶 LOW
          if (attempt < AUDIO_FALLBACK_MAX_ATTEMPT) {
            if (__DEV_LOG__) {
              console.debug(
                '[BILI-API] retry with lower quality:',
                video.bvid,
                'next attempt=',
                attempt + 1,
              );
            }
            sendNotice({
              type: NoticeType.WARN,
              message: `音频加载失败，降级重试 (${attempt + 1}/${AUDIO_FALLBACK_MAX_ATTEMPT})`,
              duration: 2000,
            });
            // 通过 ref 调最新的 initHowl，避免捕获旧版本闭包；保持 page 不变
            void initHowlRef.current?.(video, page, attempt + 1);
            return;
          }

          // 三档全部失败：停在当前曲目，等用户手动切歌
          setIsLoading(false);
          sendNotice({
            type: NoticeType.ERROR,
            message: `音频加载失败：${video.title || video.bvid}（已尝试 192K/132K/64K 全部音质），请检查网络或手动切歌`,
            duration: 5000,
          });
        },
        onplay: () => {
          // 兜底（onload 已拦截 99% 路径）：stale 实例不应推动 isPlaying / 清 playNext
          if (gen !== initGenRef.current) {
            try {
              howl.stop();
              howl.unload();
            } catch {
              /* 忽略 */
            }
            return;
          }
          setIsPlaying(true);
          setIsPausing(false);
          startRaf();
          // 防止重复清除（同一 trackId 多次 onplay 触发）
          // 用 buildTrackId(bvid, page) 比对，确保同 bvid 切 P 时仍能正确清 playNext
          const trackKey = buildTrackId(video.bvid, page);
          if (lastClearedTrackRef.current !== trackKey) {
            clearPlayNext();
            lastClearedTrackRef.current = trackKey;
          }
        },
        onpause: () => {
          if (gen !== initGenRef.current) return;
          setIsPlaying(false);
          setIsPausing(true);
          stopRaf();
        },
        onstop: () => {
          if (gen !== initGenRef.current) return;
          setIsPlaying(false);
          setIsPausing(false);
          setProgress(0);
          stopRaf();
        },
        onseek: () => {
          if (gen !== initGenRef.current) return;
          const cur = howl.seek();
          if (typeof cur === 'number') setProgress(cur);
        },
        // stale 的 onend 绝不能触发 goNext，否则会越过用户的切歌意图
        onend: () => {
          if (gen !== initGenRef.current) return;
          handleEndRef.current?.();
        },
        onplayerror: () => {
          if (gen !== initGenRef.current) return;
          howl.once('unlock', () => howl.play());
        },
      });

      // 极端 race：构造期间又被切歌（同步路径几乎不可能，但 Howl 构造内部有微任务）
      // 兜底丢弃，避免装到 howlRef 后又被新实例覆盖造成"双 howl 内存中并存"
      if (gen !== initGenRef.current) {
        try {
          howl.stop();
          howl.unload();
        } catch {
          /* 忽略 */
        }
        return;
      }
      howlRef.current = howl;
      // 立即播放（首次 onplay 触发后清除 playNext）
      howl.play();
    },
    [autoPlay, biliMid, clearPlayNext, goNext, sendNotice, startRaf, stopRaf, volume],
  );

  // 把最新 initHowl 引用挂到 ref，给 onloaderror 内部递归重试用（避免 useCallback 循环依赖）
  useEffect(() => {
    initHowlRef.current = initHowl;
  }, [initHowl]);

  // 把最新 handleEnd 挂到 ref，供 Howl onend 调用，避免实例绑定旧 loopMode 闭包
  useEffect(() => {
    handleEndRef.current = handleEnd;
  }, [handleEnd]);

  // 监听 playNext 信号 + currentTrackId / currentVideo 变化
  // deps 加 currentTrackId 是为了让"同 bvid 切 P"（例如 BV1 → BV1:p3）也触发 effect 重跑
  useEffect(() => {
    if (!playNext) return;
    if (!currentVideo) {
      // 当前曲目被删除：自增 gen 让任何 pending initHowl 进入 stale，避免它继续构造孤儿 Howl
      initGenRef.current++;
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }
      setIsPlaying(false);
      setIsPausing(false);
      stopRaf();
      lastClearedTrackRef.current = '';
      clearPlayNext();
      return;
    }
    // 决定起始 P：显式 :p<n> 优先，其次 video-page-pref store 的 defaultPage，最后 P1。
    // 通过 getState() 读取偏好（非订阅），避免用户偏好变化触发当前曲目重新加载。
    const bvid = currentVideo.bvid;
    const startPage = explicitPage ?? useVideoPagePrefStore.getState().getDefaultPage(bvid) ?? 1;
    setHasLyricFetchTry(false);
    void initHowl(currentVideo, startPage);
  }, [playNext, currentTrackId, currentVideo, explicitPage, initHowl, clearPlayNext, stopRaf]);

  // 音量变化同步到 Howl
  useEffect(() => {
    if (howlRef.current) howlRef.current.volume(volume);
  }, [volume]);

  // 自动从云端拉取歌词（每曲仅尝试一次；失败完全独立于音频播放，仅显示"暂无歌词"）
  useEffect(() => {
    if (!currentVideo) return;
    const exist = lyricMaps[currentVideo.bvid];
    if (exist?.lyricText) return;
    if (hasLyricFetchTry) return;
    setHasLyricFetchTry(true);
    const bvid = currentVideo.bvid;

    LyricApi.getLyricByBvid(bvid)
      .then((resp) => {
        const content = (resp as { content?: string; id?: number })?.content;
        if (content) {
          updateLyric({
            bvid,
            lyricText: content,
            offset: 0,
            cloudLyricId: (resp as { id?: number })?.id,
          });
        }
        // content 为空（云端无此歌词）：保持无 entry 状态，UI 显示"暂无歌词"
      })
      .catch((e: unknown) => {
        // 接口超时 / 4xx / 5xx / 网络错误：歌词无法加载是软降级，不影响播放
        if (__DEV_LOG__) console.debug('[lyric] 云端歌词获取失败（已降级到无歌词模式）：', e);
      });
  }, [currentVideo, lyricMaps, hasLyricFetchTry, updateLyric]);

  // 卸载时释放
  useEffect(() => {
    return () => {
      // 自增 gen：让卸载后才 resolve 的 pending fetchMusicUrl 不再构造 Howl
      initGenRef.current++;
      stopRaf();
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }
    };
  }, [stopRaf]);

  // === 控制函数 ===
  const togglePlay = useCallback(() => {
    if (isLoading) return;
    if (!currentVideo) return;
    const howl = howlRef.current;
    if (!howl) {
      // 没有 Howl 实例：从用户当前 TrackId / 默认 P 起播
      const bvid = currentVideo.bvid;
      const startPage = explicitPage ?? useVideoPagePrefStore.getState().getDefaultPage(bvid) ?? 1;
      void initHowl(currentVideo, startPage);
      return;
    }
    if (howl.playing()) {
      howl.pause();
    } else {
      howl.play();
    }
  }, [isLoading, currentVideo, explicitPage, initHowl]);

  const seek = useCallback((seconds: number) => {
    const howl = howlRef.current;
    if (!howl) return;
    howl.seek(seconds);
    setProgress(seconds);
  }, []);

  const cycleLoopMode = useCallback(() => {
    const idx = LOOP_MODE_CYCLE.indexOf(loopMode);
    setLoopMode(LOOP_MODE_CYCLE[(idx + 1) % LOOP_MODE_CYCLE.length]);
  }, [loopMode, setLoopMode]);

  const lyricEntry = currentVideo ? lyricMaps[currentVideo.bvid] : undefined;

  // 歌词查找器
  const lyricFinder = useMemo(() => {
    if (!lyricEntry?.lyricText) return null;
    try {
      const parsed = parseLRC(lyricEntry.lyricText);
      const lyrics = (parsed as { lyrics?: Array<{ timestamp: number; content: string }> }).lyrics;
      if (!lyrics || lyrics.length === 0) return null;
      // lyricEntry.offset 单位是毫秒，createLyricsFinder 的 offset 是秒
      return createLyricsFinder(
        lyrics.map((it) => ({ lineTime: it.timestamp, lineContent: it.content })),
        (lyricEntry.offset ?? 0) / 1000,
      );
    } catch (e) {
      console.debug('歌词解析失败：', e);
      return null;
    }
  }, [lyricEntry]);

  const currentLyricLine = useMemo(() => {
    if (!lyricFinder || !isPlaying) return '';
    return lyricFinder(progress) ?? '';
  }, [lyricFinder, isPlaying, progress]);

  // === 媒体会话 API：系统媒体键 / 锁屏 / 通知中心控件 ===
  // metadata 已在 initHowl 中按曲目设置；此处补 actionHandler + playbackState
  // 注：浏览器需要在此前已发生用户手势（点击播放）才会真正暴露 mediaSession，
  // jsdom 测试环境也基本支持 setActionHandler；不支持时 if 短路即可
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      // setActionHandler 对未支持的 action 会抛 NotSupportedError，吞掉即可
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* ignore: 浏览器不支持该 action */
      }
    };

    safeSet('play', () => togglePlay());
    safeSet('pause', () => togglePlay());
    safeSet('previoustrack', () => goPrev());
    safeSet('nexttrack', () => goNext());
    safeSet('seekto', (e) => {
      const seekTime = (e as MediaSessionActionDetails & { seekTime?: number }).seekTime;
      if (typeof seekTime === 'number') seek(seekTime);
    });
    safeSet('stop', () => {
      if (howlRef.current) {
        howlRef.current.stop();
      }
    });

    return () => {
      safeSet('play', null);
      safeSet('pause', null);
      safeSet('previoustrack', null);
      safeSet('nexttrack', null);
      safeSet('seekto', null);
      safeSet('stop', null);
    };
  }, [togglePlay, goNext, goPrev, seek]);

  // 同步 playbackState（控制锁屏/通知中心 play/pause 图标）
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (isPlaying) ms.playbackState = 'playing';
    else if (currentVideo) ms.playbackState = 'paused';
    else ms.playbackState = 'none';
  }, [isPlaying, currentVideo]);

  // 同步 progress / duration 到 player-runtime store，让 LyricViewer 等"非主控"消费方
  // 不必再调 useMusicPlayer 创建第二个 Howl 实例（避免播放器 state 不一致 / 歌词不滚动）
  useEffect(() => {
    usePlayerRuntimeStore.setState({ progress });
  }, [progress]);
  useEffect(() => {
    usePlayerRuntimeStore.setState({ duration });
  }, [duration]);
  useEffect(() => {
    // 把 seek 函数引用注册到 store，供 LyricViewer 等订阅方双击歌词跳转使用
    usePlayerRuntimeStore.setState({ seek });
  }, [seek]);

  // 同步 isPlaying 到 runtime store，供托盘菜单等非主控订阅方使用
  useEffect(() => {
    usePlayerRuntimeStore.setState({ isPlaying });
  }, [isPlaying]);

  // 注册播放控制函数指针：供托盘菜单 / 全局快捷键等非 React 上下文调用
  // 卸载时清空，避免 stale 引用触发已卸载 hook 的 setState
  useEffect(() => {
    usePlayerRuntimeStore.setState({
      togglePlay,
      goNext,
      goPrev,
    });
    return () => {
      usePlayerRuntimeStore.setState({
        togglePlay: undefined,
        goNext: undefined,
        goPrev: undefined,
      });
    };
  }, [togglePlay, goNext, goPrev]);

  // 注册 switchToPage：让 PlayingQueue 等外部组件可请求切到当前投稿的指定 P
  // 不动 usePlayingListStore.current（保持用户视角 TrackId 稳定），仅重建 Howl
  useEffect(() => {
    const switchToPage = (page: number) => {
      if (!currentVideo) return;
      const totalP = currentVideo.videos ?? 1;
      const target = Math.max(1, Math.min(totalP, Math.floor(page)));
      void initHowl(currentVideo, target);
    };
    usePlayerRuntimeStore.setState({ switchToPage });
    return () => {
      usePlayerRuntimeStore.setState({ switchToPage: undefined });
    };
  }, [currentVideo, initHowl]);

  // 进度同步到 setPositionState（每秒采样 progressRef，避免 RAF 60Hz setProgress 让 effect 反复重建定时器）
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (typeof ms.setPositionState !== 'function') return;
    if (!duration || !isPlaying) return;

    const sync = () => {
      try {
        ms.setPositionState!({
          duration,
          position: Math.min(progressRef.current, duration),
          playbackRate: 1,
        });
      } catch {
        /* duration 与 position 可能短暂不一致触发抛错，忽略 */
      }
    };

    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [duration, isPlaying]);

  return {
    isLoading,
    isPlaying,
    isPausing,
    progress,
    duration,
    currentVideo,
    currentLyricLine,
    togglePlay,
    next: goNext,
    prev: goPrev,
    seek,
    setVolume: setVolumeStore,
    cycleLoopMode,
  };
}
