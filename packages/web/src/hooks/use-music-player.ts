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
  urlPrefixFixed,
  LyricApi,
  NoticeType,
  parseLRC,
  createLyricsFinder,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';

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
 */
export function useMusicPlayer(): PlayerState & PlayerControls {
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastClearedBvRef = useRef<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasLyricFetchTry, setHasLyricFetchTry] = useState(false);

  const biliMid = useBilibiliUserStore((s) => s.current?.mid);
  const currentBvId = usePlayingListStore((s) => s.current);
  const playNext = usePlayingListStore((s) => s.playNext);
  const clearPlayNext = usePlayingListStore((s) => s.clearPlayNext);
  const updateCurrentPlaying = usePlayingListStore((s) => s.updateCurrentPlaying);
  const getNextIndex = usePlayingListStore((s) => s.getNextIndex);
  const getPrevIndex = usePlayingListStore((s) => s.getPrevIndex);

  const videoEntities = useBilibiliVideosStore((s) => s.entities);
  const currentVideo = currentBvId ? videoEntities[currentBvId] ?? null : null;

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
    async (video: BilibiliVideo) => {
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

      // mediaSession 元数据
      if ('mediaSession' in navigator && video.title) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: video.title,
          artist: video.author,
          artwork: video.pic ? [{ src: urlPrefixFixed(video.pic) }] : undefined,
        });
      }

      const url = await fetchMusicUrl(video.bvid, biliMid);
      if (!url) {
        setIsLoading(false);
        sendNotice({
          type: NoticeType.ERROR,
          message: `获取音频地址失败：${video.bvid}`,
          duration: 3000,
        });
        // 自动跳下一首避免卡住队列
        setTimeout(() => goNext(), 500);
        return;
      }

      const howl = new Howl({
        src: [url],
        html5: true,
        volume,
        onload: () => {
          setIsLoading(false);
          setDuration(howl.duration());
          if (autoPlay) howl.play();
        },
        onloaderror: () => {
          setIsLoading(false);
          sendNotice({
            type: NoticeType.ERROR,
            message: '音频加载失败',
            duration: 3000,
          });
          setTimeout(() => goNext(), 500);
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

  // 自动从云端拉取歌词（每曲仅尝试一次）
  useEffect(() => {
    if (!currentVideo) return;
    const exist = lyricMaps[currentVideo.bvid];
    if (exist?.lyricText) return;
    if (hasLyricFetchTry) return;
    setHasLyricFetchTry(true);

    LyricApi.getLyricByBvid(currentVideo.bvid)
      .then((resp) => {
        const content = (resp as { content?: string; id?: number })?.content;
        if (content) {
          updateLyric({
            bvid: currentVideo.bvid,
            lyricText: content,
            offset: 0,
            cloudLyricId: (resp as { id?: number })?.id,
          });
        }
      })
      .catch((e: unknown) => {
        console.debug('云端歌词获取失败：', e);
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
