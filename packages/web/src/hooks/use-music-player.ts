import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import {
  useBilibiliUserStore,
  useBilibiliVideosStore,
  usePlayingListStore,
  usePlayerProfileStore,
  useLyricsStore,
  useUIStore,
  fetchMusicUrl,
  invalidateMusicUrlCache,
  urlPrefixFixed,
  LyricApi,
  NoticeType,
  parseLRC,
  createLyricsFinder,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';

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
 * 输出到 webview 控制台，方便定位 Tauri Rust 代理 (bili-stream://) 的真实失败原因。
 *
 * 仅 onloaderror 触发；正常播放路径无开销。WebView fetch 命中自定义协议时 Tauri 会走
 * UriSchemeResponder，与 audio 标签同链路，能复现失败响应。
 */
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

export function useMusicPlayer(): PlayerState & PlayerControls {
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastClearedBvRef = useRef<string>('');
  // mediaSession.setPositionState 用 ref 读最新进度，避免高频 setProgress 让 effect 反复重建定时器
  const progressRef = useRef(0);
  // initHowl 自递归（onloaderror 重试时调用最新版本）通过 ref 解耦，避免 useCallback 循环依赖
  const initHowlRef = useRef<((video: BilibiliVideo, attempt?: number) => Promise<void>) | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasLyricFetchTry, setHasLyricFetchTry] = useState(false);

  progressRef.current = progress;

  const biliMid = useBilibiliUserStore((s) => s.current?.mid);
  const currentBvId = usePlayingListStore((s) => s.current);
  const playNext = usePlayingListStore((s) => s.playNext);
  const clearPlayNext = usePlayingListStore((s) => s.clearPlayNext);
  const updateCurrentPlaying = usePlayingListStore((s) => s.updateCurrentPlaying);
  const getNextIndex = usePlayingListStore((s) => s.getNextIndex);
  const getPrevIndex = usePlayingListStore((s) => s.getPrevIndex);

  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const currentVideo = currentBvId ? (videoEntities[currentBvId] ?? null) : null;

  const volume = usePlayerProfileStore((s) => s.volume);
  const autoPlay = usePlayerProfileStore((s) => s.autoPlay);
  const loopMode = usePlayerProfileStore((s) => s.loopMode);
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
    if (loopMode === 'single' && howlRef.current) {
      howlRef.current.seek(0);
      howlRef.current.play();
      return;
    }
    goNext();
  }, [loopMode, goNext]);

  // 初始化 Howl 实例
  const initHowl = useCallback(
    async (video: BilibiliVideo, attempt: number = 0) => {
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
      // 仅 attempt=0 时刷新（重试不需要重置元数据）
      if (
        attempt === 0 &&
        'mediaSession' in navigator &&
        typeof MediaMetadata !== 'undefined' &&
        video.title
      ) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: video.title,
          artist: video.author,
          artwork: video.pic ? [{ src: urlPrefixFixed(video.pic) }] : undefined,
        });
      }

      const url = await fetchMusicUrl(video.bvid, biliMid, attempt);
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
      if (!url) {
        setIsLoading(false);
        // 解析失败直接停在当前曲目，不再自动跳下一首：避免接口故障时整个队列被快速跑空
        sendNotice({
          type: NoticeType.ERROR,
          message: `获取音频地址失败：${video.bvid}。请检查网络或 B 站登录状态后手动切歌`,
          duration: 5000,
        });
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
          setIsLoading(false);
          setDuration(howl.duration());
          if (autoPlay) howl.play();
        },
        onloaderror: (id, err) => {
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
            // 通过 ref 调最新的 initHowl，避免捕获旧版本闭包
            void initHowlRef.current?.(video, attempt + 1);
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
          setIsPlaying(true);
          setIsPausing(false);
          startRaf();
          // 防止重复清除（同一首歌多次 onplay 触发）
          if (lastClearedBvRef.current !== video.bvid) {
            clearPlayNext();
            lastClearedBvRef.current = video.bvid;
          }
        },
        onpause: () => {
          setIsPlaying(false);
          setIsPausing(true);
          stopRaf();
        },
        onstop: () => {
          setIsPlaying(false);
          setIsPausing(false);
          setProgress(0);
          stopRaf();
        },
        onseek: () => {
          const cur = howl.seek();
          if (typeof cur === 'number') setProgress(cur);
        },
        onend: handleEnd,
        onplayerror: () => {
          howl.once('unlock', () => howl.play());
        },
      });
      howlRef.current = howl;
      // 立即播放（首次 onplay 触发后清除 playNext）
      howl.play();
    },
    [autoPlay, biliMid, clearPlayNext, goNext, handleEnd, sendNotice, startRaf, stopRaf, volume],
  );

  // 把最新 initHowl 引用挂到 ref，给 onloaderror 内部递归重试用（避免 useCallback 循环依赖）
  useEffect(() => {
    initHowlRef.current = initHowl;
  }, [initHowl]);

  // 监听 playNext 信号 + currentVideo 变化
  useEffect(() => {
    if (!playNext) return;
    if (!currentVideo) {
      // 当前曲目被删除，停止并清除信号
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }
      setIsPlaying(false);
      setIsPausing(false);
      stopRaf();
      lastClearedBvRef.current = '';
      clearPlayNext();
      return;
    }
    setHasLyricFetchTry(false);
    initHowl(currentVideo);
  }, [playNext, currentVideo, initHowl, clearPlayNext, stopRaf]);

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
      initHowl(currentVideo);
      return;
    }
    if (howl.playing()) {
      howl.pause();
    } else {
      howl.play();
    }
  }, [isLoading, currentVideo, initHowl]);

  const seek = useCallback((seconds: number) => {
    const howl = howlRef.current;
    if (!howl) return;
    howl.seek(seconds);
    setProgress(seconds);
  }, []);

  const cycleLoopMode = useCallback(() => {
    const next = loopMode === 'single' ? 'loop' : loopMode === 'loop' ? 'random' : 'single';
    setLoopMode(next);
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
