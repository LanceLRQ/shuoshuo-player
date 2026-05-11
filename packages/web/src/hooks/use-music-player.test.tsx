/**
 * H1: useMusicPlayer Howler 全回调状态同步单测
 *
 * 验证 Howler 的 8 个回调（onload / onloaderror / onplay / onpause / onstop /
 * onseek / onend / onplayerror）触发后 hook 状态正确同步。
 *
 * Mock 策略：
 * - vi.mock('howler') 截获 Howl 构造函数，捕获 config 中的回调；
 * - vi.mock fetchMusicUrl 直接 resolve 一个固定 URL；
 * - 通过 setState 直接预置 playing-list 与 bili-videos 来构造 currentVideo；
 * - 用 act() 同步触发回调，断言 result.current 状态。
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useBilibiliVideosStore,
  usePlayingListStore,
  usePlayerProfileStore,
  useLyricsStore,
  useUIStore,
  fetchMusicUrl,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';

// === Mock fetchMusicUrl 与 LyricApi（避免真实 axios 请求） ===
vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    fetchMusicUrl: vi.fn(async () => 'https://test.example/audio.m4s'),
    LyricApi: { getLyricByBvid: vi.fn(async () => ({ content: '', id: 0 })) },
  };
});

// === Mock howler（用 vi.hoisted + 普通 function 实现，确保 `new Howl()` 可用） ===
interface CapturedCallbacks {
  onload?: () => void;
  onloaderror?: () => void;
  onplay?: () => void;
  onpause?: () => void;
  onstop?: () => void;
  onseek?: () => void;
  onend?: () => void;
  onplayerror?: () => void;
}

const howlerState = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    lastCb: {},
    lastInstance: null,
    isPlayingMock: false,
    seekValueMock: 0,
    durationMock: 240,
  };

  // 使用 function 关键字让 mock 可作为 constructor 调用
  state.HowlMock = vi.fn(function MockHowl(config: CapturedCallbacks) {
    state.lastCb = config;
    const instance = {
      play: vi.fn(() => {
        state.isPlayingMock = true;
      }),
      pause: vi.fn(() => {
        state.isPlayingMock = false;
      }),
      stop: vi.fn(() => {
        state.isPlayingMock = false;
      }),
      seek: vi.fn((s?: number) => {
        if (typeof s === 'number') {
          state.seekValueMock = s;
          return undefined;
        }
        return state.seekValueMock;
      }),
      volume: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      unload: vi.fn(),
      duration: vi.fn(() => state.durationMock),
      playing: vi.fn(() => state.isPlayingMock),
      state: vi.fn(() => 'loaded'),
    };
    state.lastInstance = instance;
    return instance;
  });

  return state as {
    lastCb: CapturedCallbacks;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lastInstance: any;
    isPlayingMock: boolean;
    seekValueMock: number;
    durationMock: number;
    HowlMock: ReturnType<typeof vi.fn>;
  };
});

vi.mock('howler', () => ({
  Howl: howlerState.HowlMock,
}));

// 必须在 mock 之后再 import 被测 hook
import { useMusicPlayer } from './use-music-player';

const TEST_VIDEO: BilibiliVideo = {
  aid: 1,
  bvid: 'BV1Test00001',
  created: 0,
  length: '00:01',
  pic: '',
  is_union_video: false,
  title: 'Test Song',
  sub_title: '',
  play: 0,
  comment: 0,
  author: 'Test Author',
  description: '',
  mid: 1,
};

function resetStores() {
  useBilibiliVideosStore.setState({
    ids: [TEST_VIDEO.bvid],
    entities: { [TEST_VIDEO.bvid]: TEST_VIDEO },
  });
  usePlayingListStore.setState({
    favId: 'main',
    bvIds: [TEST_VIDEO.bvid],
    current: TEST_VIDEO.bvid,
    playNext: false,
  });
  usePlayerProfileStore.setState({
    volume: 0.5,
    autoPlay: true,
    loopMode: 'loop',
  });
  useLyricsStore.setState({ lyricMaps: {} });
}

describe('H1: useMusicPlayer Howler 回调状态同步', () => {
  beforeEach(() => {
    howlerState.HowlMock.mockClear();
    howlerState.lastCb = {};
    howlerState.lastInstance = null as never;
    howlerState.isPlayingMock = false;
    howlerState.seekValueMock = 0;
    howlerState.durationMock = 240;
    resetStores();

    // RAF：jsdom 默认有 RAF，这里覆盖为同步触发避免泄漏
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('初始化 Howl：触发 playNext → fetchMusicUrl → 构造 Howl', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });

    await waitFor(() => {
      expect(howlerState.HowlMock).toHaveBeenCalledTimes(1);
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('onload 触发：isLoading=false + duration 同步 + autoPlay 启动', async () => {
    howlerState.durationMock = 320;

    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      howlerState.lastCb.onload?.();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.duration).toBe(320);
    expect(howlerState.lastInstance!.play).toHaveBeenCalled();
  });

  it('onloaderror 触发：单次 onloaderror 进入音质降级重试，三档全失败后 isLoading=false', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(1));

    // attempt=0 失败：触发降级重试 → 构造第二个 Howl（attempt=1）
    await act(async () => {
      howlerState.lastCb.onloaderror?.();
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(2));
    // 重试期间仍处于 loading 态（重新进入 setIsLoading(true)）
    expect(result.current.isLoading).toBe(true);

    // attempt=1 失败：触发降级重试 → 构造第三个 Howl（attempt=2）
    await act(async () => {
      howlerState.lastCb.onloaderror?.();
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(3));
    expect(result.current.isLoading).toBe(true);

    // attempt=2 失败：三档全部失败 → 停止重试，isLoading=false
    await act(async () => {
      howlerState.lastCb.onloaderror?.();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('fetchMusicUrl 返回空 + 触发 onFinalError(network)：弹"网络异常"toast，停在当前曲目', async () => {
    useUIStore.setState({ notices: [] });
    const initialBvId = usePlayingListStore.getState().current;
    // 模拟 fetchMusicUrl 真实失败行为：调用 onFinalError 后 resolve ''
    // 与 hook 实际接入的 options.onFinalError 路径对齐
    vi.mocked(fetchMusicUrl).mockImplementationOnce(async (bvid, _mid, _attempt, options) => {
      options?.onFinalError?.({
        kind: 'network',
        message: 'simulated DNS failure',
        bvid: bvid as string,
        attempt: 0,
        retryCount: 2,
      });
      return '';
    });

    renderHook(() => useMusicPlayer());
    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });

    await waitFor(() =>
      expect(useUIStore.getState().notices.some((n) => /网络异常/.test(n.message))).toBe(true),
    );
    // 当前曲目未变（没自动跳下一首）
    expect(usePlayingListStore.getState().current).toBe(initialBvId);
  });

  it('onloaderror：三档音质全部失败后弹"已尝试 192K/132K/64K"通知，停在当前曲目（不自动跳下一首）', async () => {
    useUIStore.setState({ notices: [] });
    const initialBvId = usePlayingListStore.getState().current;
    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(1));

    // 连续三次 onloaderror（attempt=0/1/2 全失败）
    await act(async () => {
      howlerState.lastCb.onloaderror?.();
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      howlerState.lastCb.onloaderror?.();
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(3));
    await act(async () => {
      howlerState.lastCb.onloaderror?.();
    });

    // 仅最终全失败时弹的 ERROR 通知含"已尝试 192K/132K/64K"
    await waitFor(() =>
      expect(
        useUIStore.getState().notices.some((n) => /已尝试 192K\/132K\/64K/.test(n.message)),
      ).toBe(true),
    );
    expect(usePlayingListStore.getState().current).toBe(initialBvId);
  });

  it('onplay 触发：isPlaying=true + isPausing=false + clearPlayNext', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      howlerState.lastCb.onplay?.();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.isPausing).toBe(false);
    expect(usePlayingListStore.getState().playNext).toBe(false);
  });

  it('onpause 触发：isPlaying=false + isPausing=true', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      howlerState.lastCb.onplay?.();
    });
    act(() => {
      howlerState.lastCb.onpause?.();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPausing).toBe(true);
  });

  it('play→pause→play 进度不重置（progress 由 onstop 触发才会清零）', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    // 模拟播放到 30s
    howlerState.seekValueMock = 30;
    act(() => {
      howlerState.lastCb.onplay?.();
      howlerState.lastCb.onseek?.();
    });
    expect(result.current.progress).toBe(30);

    act(() => {
      howlerState.lastCb.onpause?.();
    });
    expect(result.current.progress).toBe(30);

    act(() => {
      howlerState.lastCb.onplay?.();
    });
    expect(result.current.progress).toBe(30);
  });

  it('onstop 触发：isPlaying=false + isPausing=false + progress=0', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    howlerState.seekValueMock = 30;
    act(() => {
      howlerState.lastCb.onplay?.();
      howlerState.lastCb.onseek?.();
    });
    expect(result.current.progress).toBe(30);

    act(() => {
      howlerState.lastCb.onstop?.();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPausing).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('onseek 触发：progress 同步到 howl.seek() 返回值', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    howlerState.seekValueMock = 75;
    act(() => {
      howlerState.lastCb.onseek?.();
    });

    expect(result.current.progress).toBe(75);
  });

  it('onend (loop 模式) 触发 next：updateCurrentPlaying 被调用切到下一首', async () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Test00001', 'BV1Test00002'],
      entities: {
        BV1Test00001: TEST_VIDEO,
        BV1Test00002: { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Track 2' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      bvIds: ['BV1Test00001', 'BV1Test00002'],
      current: 'BV1Test00001',
      playNext: false,
    });

    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      howlerState.lastCb.onplay?.();
    });

    act(() => {
      howlerState.lastCb.onend?.();
    });

    // onend 在 loop 模式下调用 goNext → updateCurrentPlaying 推进到下一首
    expect(usePlayingListStore.getState().current).toBe('BV1Test00002');
  });

  it('onend (single 循环) 触发：seek(0) + play()，不切歌', async () => {
    usePlayerProfileStore.setState({ volume: 0.5, autoPlay: true, loopMode: 'single' });

    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    howlerState.lastInstance!.play.mockClear();

    act(() => {
      howlerState.lastCb.onend?.();
    });

    expect(howlerState.lastInstance!.seek).toHaveBeenCalledWith(0);
    expect(howlerState.lastInstance!.play).toHaveBeenCalledTimes(1);
    expect(usePlayingListStore.getState().current).toBe('BV1Test00001');
  });

  it('onplayerror 触发：注册 unlock once（行为不抛错）', async () => {
    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    expect(() => {
      act(() => {
        howlerState.lastCb.onplayerror?.();
      });
    }).not.toThrow();

    expect(howlerState.lastInstance!.once).toHaveBeenCalledWith('unlock', expect.any(Function));
  });

  it('currentVideo 被删除时 stop + 清除 playNext', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // 模拟从队列删除当前曲目
    await act(async () => {
      useBilibiliVideosStore.setState({ ids: [], entities: {} });
      usePlayingListStore.setState({ playNext: true, current: '' });
    });

    expect(howlerState.lastInstance!.stop).toHaveBeenCalled();
    expect(usePlayingListStore.getState().playNext).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });
});

describe('H1: useMusicPlayer 媒体会话 API 接入', () => {
  // 用 Map 记录已注册的 actionHandler，便于断言并重放
  const handlers = new Map<string, MediaSessionActionHandler | null>();
  let originalMediaSession: MediaSession | undefined;

  beforeEach(() => {
    howlerState.HowlMock.mockClear();
    howlerState.lastCb = {};
    howlerState.lastInstance = null as never;
    howlerState.isPlayingMock = false;
    howlerState.seekValueMock = 0;
    howlerState.durationMock = 240;
    handlers.clear();
    resetStores();

    originalMediaSession = (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: {
        playbackState: 'none' as MediaSessionPlaybackState,
        metadata: null,
        setActionHandler: (action: string, h: MediaSessionActionHandler | null) => {
          handlers.set(action, h);
        },
        setPositionState: vi.fn(),
      },
    });
    // jsdom 不提供 MediaMetadata 全局类，stub 一个允许 `new MediaMetadata()` 不抛错的存根
    vi.stubGlobal(
      'MediaMetadata',
      vi.fn(function MockMediaMetadata() {
        return {} as MediaMetadata;
      }),
    );

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    if (originalMediaSession === undefined) {
      delete (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
    } else {
      (navigator as unknown as { mediaSession: MediaSession }).mediaSession = originalMediaSession;
    }
    vi.unstubAllGlobals();
  });

  it('挂载后注册 6 个 ActionHandler（play/pause/previoustrack/nexttrack/seekto/stop）', () => {
    renderHook(() => useMusicPlayer());
    expect(handlers.has('play')).toBe(true);
    expect(handlers.has('pause')).toBe(true);
    expect(handlers.has('previoustrack')).toBe(true);
    expect(handlers.has('nexttrack')).toBe(true);
    expect(handlers.has('seekto')).toBe(true);
    expect(handlers.has('stop')).toBe(true);
  });

  it('nexttrack 触发后切到下一首（与系统媒体键 / 锁屏行为对齐）', async () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Test00001', 'BV1Test00002'],
      entities: {
        BV1Test00001: TEST_VIDEO,
        BV1Test00002: { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Track 2' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      bvIds: ['BV1Test00001', 'BV1Test00002'],
      current: 'BV1Test00001',
      playNext: false,
    });

    renderHook(() => useMusicPlayer());

    act(() => {
      handlers.get('nexttrack')?.({ action: 'nexttrack' } as MediaSessionActionDetails);
    });

    expect(usePlayingListStore.getState().current).toBe('BV1Test00002');
  });

  it('seekto 触发后调用内部 seek（progress 同步）', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      handlers.get('seekto')?.({ action: 'seekto', seekTime: 88 } as MediaSessionActionDetails);
    });

    expect(howlerState.lastInstance!.seek).toHaveBeenCalledWith(88);
    expect(result.current.progress).toBe(88);
  });

  it('stop 触发后调用 howl.stop()', async () => {
    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      handlers.get('stop')?.({ action: 'stop' } as MediaSessionActionDetails);
    });

    expect(howlerState.lastInstance!.stop).toHaveBeenCalled();
  });

  it('isPlaying 切换时同步 playbackState 到 mediaSession', async () => {
    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      howlerState.lastCb.onplay?.();
    });
    expect(navigator.mediaSession.playbackState).toBe('playing');

    act(() => {
      howlerState.lastCb.onpause?.();
    });
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });

  it('卸载时清理所有 ActionHandler（防内存泄漏 / 跨页面冲突）', () => {
    const { unmount } = renderHook(() => useMusicPlayer());
    expect(handlers.get('play')).not.toBeNull();

    unmount();

    expect(handlers.get('play')).toBeNull();
    expect(handlers.get('pause')).toBeNull();
    expect(handlers.get('nexttrack')).toBeNull();
    expect(handlers.get('previoustrack')).toBeNull();
    expect(handlers.get('seekto')).toBeNull();
    expect(handlers.get('stop')).toBeNull();
  });
});
