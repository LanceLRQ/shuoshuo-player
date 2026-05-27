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
  useVideoPagePrefStore,
  fetchMusicUrl,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { useUIShell } from '@/stores/ui-shell';

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
    trackIds: [TEST_VIDEO.bvid],
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
      trackIds: ['BV1Test00001', 'BV1Test00002'],
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

  it('onend (once 播完就停) 触发：stop()，既不循环也不切歌', async () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Test00001', 'BV1Test00002'],
      entities: {
        BV1Test00001: TEST_VIDEO,
        BV1Test00002: { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Track 2' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      trackIds: ['BV1Test00001', 'BV1Test00002'],
      current: 'BV1Test00001',
      playNext: false,
    });
    usePlayerProfileStore.setState({ volume: 0.5, autoPlay: true, loopMode: 'once' });

    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    act(() => {
      howlerState.lastCb.onplay?.();
    });

    howlerState.lastInstance!.stop.mockClear();
    howlerState.lastInstance!.play.mockClear();

    act(() => {
      howlerState.lastCb.onend?.();
    });

    // 播完就停：曲终仅调 stop()，不 seek(0)+play() 循环，也不推进到下一首
    expect(howlerState.lastInstance!.stop).toHaveBeenCalledTimes(1);
    expect(howlerState.lastInstance!.play).not.toHaveBeenCalled();
    expect(usePlayingListStore.getState().current).toBe('BV1Test00001');
  });

  it('cycleLoopMode 四档轮换：loop → random → single → once → loop', () => {
    usePlayerProfileStore.setState({ loopMode: 'loop' });
    const { result } = renderHook(() => useMusicPlayer());

    act(() => result.current.cycleLoopMode());
    expect(usePlayerProfileStore.getState().loopMode).toBe('random');
    act(() => result.current.cycleLoopMode());
    expect(usePlayerProfileStore.getState().loopMode).toBe('single');
    act(() => result.current.cycleLoopMode());
    expect(usePlayerProfileStore.getState().loopMode).toBe('once');
    act(() => result.current.cycleLoopMode());
    expect(usePlayerProfileStore.getState().loopMode).toBe('loop');
  });

  // 回归：onend 必须读取最新 loopMode（修复前 onend 闭包捕获创建实例那刻的旧 loopMode，
  // 播放途中切到单曲循环仍会跳下一首，跳过去后才进入单曲循环）
  it('onend 取最新 loopMode（stale closure 回归）：播放途中 loop→single，onend 循环当前曲不切歌', async () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Test00001', 'BV1Test00002'],
      entities: {
        BV1Test00001: TEST_VIDEO,
        BV1Test00002: { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Track 2' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      trackIds: ['BV1Test00001', 'BV1Test00002'],
      current: 'BV1Test00001',
      playNext: false,
    });
    usePlayerProfileStore.setState({ volume: 0.5, autoPlay: true, loopMode: 'loop' });

    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());
    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // 播放途中切到单曲循环：Howl 实例不重建，onend 必须读到最新 loopMode
    await act(async () => {
      usePlayerProfileStore.setState({ loopMode: 'single' });
    });

    howlerState.lastInstance!.play.mockClear();
    act(() => {
      howlerState.lastCb.onend?.();
    });

    expect(howlerState.lastInstance!.seek).toHaveBeenCalledWith(0);
    expect(howlerState.lastInstance!.play).toHaveBeenCalledTimes(1);
    expect(usePlayingListStore.getState().current).toBe('BV1Test00001');
  });

  it('onend 取最新 loopMode：播放途中 single→loop，onend 切下一首', async () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Test00001', 'BV1Test00002'],
      entities: {
        BV1Test00001: TEST_VIDEO,
        BV1Test00002: { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Track 2' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      trackIds: ['BV1Test00001', 'BV1Test00002'],
      current: 'BV1Test00001',
      playNext: false,
    });
    usePlayerProfileStore.setState({ volume: 0.5, autoPlay: true, loopMode: 'single' });

    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());
    act(() => {
      howlerState.lastCb.onplay?.();
    });

    await act(async () => {
      usePlayerProfileStore.setState({ loopMode: 'loop' });
    });

    act(() => {
      howlerState.lastCb.onend?.();
    });

    expect(usePlayingListStore.getState().current).toBe('BV1Test00002');
  });

  it('onend (编辑歌词态) 触发：即使 loop 模式也 seek(0) + play()，不切歌', async () => {
    // 多曲 loop 队列：正常会切下一首，但编辑歌词时应强制循环当前曲避免丢失未保存编辑
    useBilibiliVideosStore.setState({
      ids: ['BV1Test00001', 'BV1Test00002'],
      entities: {
        BV1Test00001: TEST_VIDEO,
        BV1Test00002: { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Track 2' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      trackIds: ['BV1Test00001', 'BV1Test00002'],
      current: 'BV1Test00001',
      playNext: false,
    });
    useUIShell.setState({ lyricEditing: true });

    try {
      renderHook(() => useMusicPlayer());

      await act(async () => {
        usePlayingListStore.setState({ playNext: true });
      });
      await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

      howlerState.lastInstance!.play.mockClear();
      act(() => {
        howlerState.lastCb.onplay?.();
      });
      act(() => {
        howlerState.lastCb.onend?.();
      });

      expect(howlerState.lastInstance!.seek).toHaveBeenCalledWith(0);
      expect(howlerState.lastInstance!.play).toHaveBeenCalled();
      // 当前曲目未变（编辑态拦截了切歌）
      expect(usePlayingListStore.getState().current).toBe('BV1Test00001');
    } finally {
      // 复位，避免污染同 describe 内后续用例
      useUIShell.setState({ lyricEditing: false });
    }
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

  // === 双音频并发 bug 回归：快速切歌时旧请求 resolve 不应创建孤儿 Howl 自动播放 ===
  it('快速切歌竞态：旧 fetchMusicUrl 晚到（gen stale）→ 不创建第二个 Howl 实例', async () => {
    // 第二个视频
    const VIDEO_B: BilibiliVideo = { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Song B' };
    useBilibiliVideosStore.setState({
      ids: [TEST_VIDEO.bvid, VIDEO_B.bvid],
      entities: { [TEST_VIDEO.bvid]: TEST_VIDEO, [VIDEO_B.bvid]: VIDEO_B },
    });

    // 让第一次 fetchMusicUrl 永不 resolve（模拟慢网络），第二次正常 resolve
    let resolveA: ((url: string) => void) | null = null;
    vi.mocked(fetchMusicUrl)
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveA = resolve;
          }),
      )
      .mockImplementationOnce(async () => 'https://test.example/B.m4s');

    renderHook(() => useMusicPlayer());

    // 1) 触发 A 的播放，initHowl 进入 await（fetchMusicUrl A 未 resolve）
    await act(async () => {
      usePlayingListStore.setState({ current: TEST_VIDEO.bvid, playNext: true });
    });
    // A 尚未创建 Howl，因为 fetchMusicUrl pending
    expect(howlerState.HowlMock).not.toHaveBeenCalled();

    // 2) 用户快速切到 B：gen++，新 initHowl 进入，B 立即返回 URL → 构造 Howl-B
    await act(async () => {
      usePlayingListStore.setState({ current: VIDEO_B.bvid, playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(1));
    const howlBPlayCount = howlerState.lastInstance!.play.mock.calls.length;

    // 3) 现在 A 的 fetchMusicUrl 终于 resolve → 应被 gen 哨兵拦截，不构造第二个 Howl
    await act(async () => {
      resolveA?.('https://test.example/A.m4s');
      // 让 microtask 排空
      await Promise.resolve();
      await Promise.resolve();
    });

    // 关键断言：Howl 构造次数仍为 1（只有 B），A 没有产生孤儿实例
    expect(howlerState.HowlMock).toHaveBeenCalledTimes(1);
    // B 的 play 次数没变（不会被 A 路径触发额外 play）
    expect(howlerState.lastInstance!.play.mock.calls.length).toBe(howlBPlayCount);
  });

  it('快速切歌竞态：旧 Howl 的 onload 触发时（已 stale）不应调 play()', async () => {
    const VIDEO_B: BilibiliVideo = { ...TEST_VIDEO, bvid: 'BV1Test00002', title: 'Song B' };
    useBilibiliVideosStore.setState({
      ids: [TEST_VIDEO.bvid, VIDEO_B.bvid],
      entities: { [TEST_VIDEO.bvid]: TEST_VIDEO, [VIDEO_B.bvid]: VIDEO_B },
    });

    // 两次都立即返回 URL，但我们手动控制何时触发 onload
    vi.mocked(fetchMusicUrl)
      .mockImplementationOnce(async () => 'https://test.example/A.m4s')
      .mockImplementationOnce(async () => 'https://test.example/B.m4s');

    renderHook(() => useMusicPlayer());

    // 1) 播放 A，Howl-A 创建（构造时同步 play() 一次），但暂不触发 onload
    await act(async () => {
      usePlayingListStore.setState({ current: TEST_VIDEO.bvid, playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(1));
    const cbA = howlerState.lastCb;
    const instanceA = howlerState.lastInstance!;

    // 2) 切到 B：Howl-B 创建（gen++）
    await act(async () => {
      usePlayingListStore.setState({ current: VIDEO_B.bvid, playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(2));
    const instanceB = howlerState.lastInstance!;
    const playACountBefore = instanceA.play.mock.calls.length;
    const stopACountBefore = instanceA.stop.mock.calls.length;

    // 3) A 的 onload 现在才触发（旧 Howl 的回调晚到）→ 哨兵应拦截：不调 A.play()，应调 A.stop()/A.unload()
    act(() => {
      cbA.onload?.();
    });

    // A.play() 调用次数没变（onload 内的 if (autoPlay) howl.play() 未执行）
    expect(instanceA.play.mock.calls.length).toBe(playACountBefore);
    // 哨兵主动销毁 A
    expect(instanceA.stop.mock.calls.length).toBeGreaterThan(stopACountBefore);
    expect(instanceA.unload).toHaveBeenCalled();
    // B 实例不受影响
    expect(instanceB).toBe(howlerState.lastInstance);
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
      trackIds: ['BV1Test00001', 'BV1Test00002'],
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

describe('B5: 多 P 投稿分 P 连播 / 显式 :p<n> 行为', () => {
  beforeEach(() => {
    howlerState.HowlMock.mockClear();
    howlerState.lastCb = {};
    howlerState.lastInstance = null as never;
    howlerState.isPlayingMock = false;
    howlerState.seekValueMock = 0;
    howlerState.durationMock = 30;
    resetStores();
    useVideoPagePrefStore.setState({ defaultPage: {} });
    vi.mocked(fetchMusicUrl).mockReset();
    vi.mocked(fetchMusicUrl).mockResolvedValue('https://test.example/audio.m4s');
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const MULTI_VIDEO: BilibiliVideo = {
    ...TEST_VIDEO,
    bvid: 'BV1Multi00001',
    videos: 3,
    pages: [
      { cid: 100, page: 1, part: 'P1', duration: 60 },
      { cid: 101, page: 2, part: 'P2', duration: 90 },
      { cid: 102, page: 3, part: 'P3', duration: 30 },
    ],
  };

  function setupMulti(currentTrackId: string) {
    useBilibiliVideosStore.setState({
      ids: [MULTI_VIDEO.bvid, 'BV1Next00001'],
      entities: {
        [MULTI_VIDEO.bvid]: MULTI_VIDEO,
        BV1Next00001: { ...TEST_VIDEO, bvid: 'BV1Next00001', title: 'Next Song' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      trackIds: [MULTI_VIDEO.bvid, 'BV1Next00001'],
      current: currentTrackId,
      playNext: false,
    });
  }

  it('autoPlayNextPage=true + 纯 bvid + 多 P + 未到末尾 → onend 切下一 P（不动 store.current）', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: true,
    });
    setupMulti(MULTI_VIDEO.bvid);

    renderHook(() => useMusicPlayer());
    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());
    expect(vi.mocked(fetchMusicUrl).mock.calls[0]?.[4]).toBe(1);

    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // 触发 onend：P1 结束 → 应切到 P2，store.current 不变（仍是纯 bvid）
    act(() => {
      howlerState.lastCb.onend?.();
    });
    await waitFor(() =>
      expect(vi.mocked(fetchMusicUrl).mock.calls.some((c) => c[4] === 2)).toBe(true),
    );
    expect(usePlayingListStore.getState().current).toBe(MULTI_VIDEO.bvid);
  });

  it('autoPlayNextPage=false → 多 P 投稿 onend 也直接切下一首', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: false,
    });
    setupMulti(MULTI_VIDEO.bvid);

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

    expect(usePlayingListStore.getState().current).toBe('BV1Next00001');
  });

  it('显式 :p<n> TrackId 即使 autoPlayNextPage=true 也走 next（不连播）', async () => {
    // 模拟"自定义歌单"场景：trackIds 含显式 :p<n> 条目（与 §2 列表语义边界一致）
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: true,
    });
    const explicitTrack = `${MULTI_VIDEO.bvid}:p2`;
    useBilibiliVideosStore.setState({
      ids: [MULTI_VIDEO.bvid, 'BV1Next00001'],
      entities: {
        [MULTI_VIDEO.bvid]: MULTI_VIDEO,
        BV1Next00001: { ...TEST_VIDEO, bvid: 'BV1Next00001', title: 'Next Song' },
      },
    });
    usePlayingListStore.setState({
      favId: 'custom',
      trackIds: [explicitTrack, 'BV1Next00001'],
      current: explicitTrack,
      playNext: false,
    });

    renderHook(() => useMusicPlayer());
    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());
    // fetchMusicUrl 起始 P 应为 2（显式）
    expect(vi.mocked(fetchMusicUrl).mock.calls[0]?.[4]).toBe(2);

    act(() => {
      howlerState.lastCb.onplay?.();
    });
    act(() => {
      howlerState.lastCb.onend?.();
    });

    // 显式 :p2 条目 onend 直接走 next() → 队列下一首
    expect(usePlayingListStore.getState().current).toBe('BV1Next00001');
  });

  it('autoPlayNextPage=true + 末尾 P → onend 切下一首（不再尝试 P4）', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: true,
    });
    setupMulti(MULTI_VIDEO.bvid);
    // 预置默认 P 为最后一 P
    useVideoPagePrefStore.setState({ defaultPage: { [MULTI_VIDEO.bvid]: 3 } });

    renderHook(() => useMusicPlayer());
    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());
    // 起始 P=3（从 defaultPage 读取）
    expect(vi.mocked(fetchMusicUrl).mock.calls[0]?.[4]).toBe(3);

    act(() => {
      howlerState.lastCb.onplay?.();
    });
    act(() => {
      howlerState.lastCb.onend?.();
    });

    // 已经是最后 P → 切到队列下一首
    expect(usePlayingListStore.getState().current).toBe('BV1Next00001');
  });

  it('单 P 投稿 autoPlayNextPage=true 也不走分 P 连播', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: true,
    });
    useBilibiliVideosStore.setState({
      ids: [TEST_VIDEO.bvid, 'BV1Next00001'],
      entities: {
        [TEST_VIDEO.bvid]: TEST_VIDEO,
        BV1Next00001: { ...TEST_VIDEO, bvid: 'BV1Next00001', title: 'Next' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      trackIds: [TEST_VIDEO.bvid, 'BV1Next00001'],
      current: TEST_VIDEO.bvid,
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

    expect(usePlayingListStore.getState().current).toBe('BV1Next00001');
  });

  it('defaultPage 偏好：纯 bvid 起播按 defaultPage 选择初始 P', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: false,
    });
    setupMulti(MULTI_VIDEO.bvid);
    useVideoPagePrefStore.setState({ defaultPage: { [MULTI_VIDEO.bvid]: 2 } });

    renderHook(() => useMusicPlayer());
    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());

    expect(vi.mocked(fetchMusicUrl).mock.calls[0]?.[4]).toBe(2);
  });
});

describe('F4: 连续切 P 链 + 用户手动 switchToPage', () => {
  beforeEach(() => {
    howlerState.HowlMock.mockClear();
    howlerState.lastCb = {};
    howlerState.lastInstance = null as never;
    howlerState.isPlayingMock = false;
    howlerState.seekValueMock = 0;
    howlerState.durationMock = 30;
    resetStores();
    useVideoPagePrefStore.setState({ defaultPage: {} });
    vi.mocked(fetchMusicUrl).mockReset();
    vi.mocked(fetchMusicUrl).mockResolvedValue('https://test.example/audio.m4s');
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const MULTI: BilibiliVideo = {
    aid: 1,
    bvid: 'BV1ChainP00001',
    created: 0,
    length: '',
    pic: '',
    is_union_video: false,
    title: 'Chain Multi',
    sub_title: '',
    play: 0,
    comment: 0,
    author: '',
    description: '',
    videos: 3,
    pages: [
      { cid: 100, page: 1, part: 'P1', duration: 10 },
      { cid: 101, page: 2, part: 'P2', duration: 10 },
      { cid: 102, page: 3, part: 'P3', duration: 10 },
    ],
  };

  function setup(currentTrackId: string, nextBv = 'BV1ChainNext') {
    useBilibiliVideosStore.setState({
      ids: [MULTI.bvid, nextBv],
      entities: {
        [MULTI.bvid]: MULTI,
        [nextBv]: { ...TEST_VIDEO, bvid: nextBv, title: 'After Chain' },
      },
    });
    usePlayingListStore.setState({
      favId: 'main',
      trackIds: [MULTI.bvid, nextBv],
      current: currentTrackId,
      playNext: false,
    });
  }

  it('autoPlayNextPage=true：onend P1→P2→P3→队列下一首 (3 段链)', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: true,
    });
    setup(MULTI.bvid);

    renderHook(() => useMusicPlayer());

    // P1 启动
    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetchMusicUrl).mock.calls[0]?.[4]).toBe(1);
    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // P1 结束 → P2
    act(() => {
      howlerState.lastCb.onend?.();
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(2));
    expect(vi.mocked(fetchMusicUrl).mock.calls.at(-1)?.[4]).toBe(2);
    // store.current 维持纯 bvid 不变
    expect(usePlayingListStore.getState().current).toBe(MULTI.bvid);
    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // P2 结束 → P3
    act(() => {
      howlerState.lastCb.onend?.();
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(3));
    expect(vi.mocked(fetchMusicUrl).mock.calls.at(-1)?.[4]).toBe(3);
    expect(usePlayingListStore.getState().current).toBe(MULTI.bvid);
    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // P3 结束（末尾 P）→ 切到队列下一首
    act(() => {
      howlerState.lastCb.onend?.();
    });
    expect(usePlayingListStore.getState().current).toBe('BV1ChainNext');
  });

  it('用户手动 switchToPage(n) → 触发新的 fetchMusicUrl + Howler 重建', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: false,
    });
    setup(MULTI.bvid);
    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetchMusicUrl).mock.calls[0]?.[4]).toBe(1);
    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // 模拟外部组件（PartSelector / PlayingQueue）调 switchToPage(2)
    const switchToPage = usePlayerRuntimeStore.getState().switchToPage;
    expect(switchToPage).toBeTypeOf('function');
    await act(async () => {
      switchToPage?.(2);
    });

    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalledTimes(2));
    expect(vi.mocked(fetchMusicUrl).mock.calls.at(-1)?.[4]).toBe(2);
    // playingPage 状态推送到 runtime store
    expect(usePlayerRuntimeStore.getState().playingPage).toBe(2);
    // store.current 不动（用户视角 TrackId 稳定）
    expect(usePlayingListStore.getState().current).toBe(MULTI.bvid);
  });

  it('switchToPage 越界值被 clamp 到 [1, totalP]', async () => {
    usePlayerProfileStore.setState({
      volume: 0.5,
      autoPlay: true,
      loopMode: 'loop',
      autoPlayNextPage: false,
    });
    setup(MULTI.bvid);
    renderHook(() => useMusicPlayer());

    await act(async () => {
      usePlayingListStore.setState({ playNext: true });
    });
    await waitFor(() => expect(howlerState.HowlMock).toHaveBeenCalled());
    act(() => {
      howlerState.lastCb.onplay?.();
    });

    // 越界上限：传 99 → clamp 到 3
    const switchToPage = usePlayerRuntimeStore.getState().switchToPage;
    await act(async () => {
      switchToPage?.(99);
    });
    expect(usePlayerRuntimeStore.getState().playingPage).toBe(3);

    // 越界下限：传 0 / 负数 → clamp 到 1
    await act(async () => {
      switchToPage?.(0);
    });
    expect(usePlayerRuntimeStore.getState().playingPage).toBe(1);

    await act(async () => {
      switchToPage?.(-5);
    });
    expect(usePlayerRuntimeStore.getState().playingPage).toBe(1);
  });
});
