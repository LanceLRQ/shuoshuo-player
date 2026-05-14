const mockInvoke = vi.fn();
const mockListen = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

import { startTraySync } from './tray-sync';
import {
  useBilibiliVideosStore,
  usePlayingListStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';

function makeVideo(bvid: string, title: string, author: string): BilibiliVideo {
  return {
    bvid,
    title,
    author,
    pic: '',
    cid: 0,
    pubdate: 0,
    duration: 0,
    videos: 1,
    pages: [],
  } as BilibiliVideo;
}

describe('tray-sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => {});
    useBilibiliVideosStore.setState({ ids: [], entities: {} });
    usePlayingListStore.setState({ favId: '', trackIds: [], current: '', playNext: false });
    usePlayerRuntimeStore.setState({
      isPlaying: false,
      togglePlay: undefined,
      goNext: undefined,
      goPrev: undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('启动时推送当前 isPlaying 与曲目标签（无曲目时空串）', async () => {
    startTraySync();
    // 节流窗口外 isPlaying 立即发；标题首发也立即（lastLabel 为 null）
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_play_state', { isPlaying: false });
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_track_label', { label: '' });
  });

  it('曲目切换：推送 "♪ 标题 - 作者" 文案（节流后）', async () => {
    startTraySync();
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    mockInvoke.mockClear();

    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: makeVideo('BV1', '隐形的翅膀', '张韶涵') },
    });
    usePlayingListStore.setState({ current: 'BV1' });
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_track_label', {
      label: '♪ 隐形的翅膀 - 张韶涵',
    });
  });

  it('isPlaying 变化推送 setTrayPlayState', async () => {
    startTraySync();
    await Promise.resolve();
    mockInvoke.mockClear();

    usePlayerRuntimeStore.setState({ isPlaying: true });
    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledWith('tray_set_play_state', { isPlaying: true });
  });

  it('listen tray:command 派发到 store 注册的播放控制指针', async () => {
    const togglePlay = vi.fn();
    const goNext = vi.fn();
    const goPrev = vi.fn();
    usePlayerRuntimeStore.setState({ togglePlay, goNext, goPrev });

    startTraySync();
    await Promise.resolve();

    expect(mockListen).toHaveBeenCalledWith('tray:command', expect.any(Function));
    const handler = mockListen.mock.calls[0][1] as (e: { payload: string }) => void;

    handler({ payload: 'play-pause' });
    expect(togglePlay).toHaveBeenCalledTimes(1);

    handler({ payload: 'next' });
    expect(goNext).toHaveBeenCalledTimes(1);

    handler({ payload: 'prev' });
    expect(goPrev).toHaveBeenCalledTimes(1);

    handler({ payload: 'unknown' });
    // 不应抛错，且各指针调用计数不变
    expect(togglePlay).toHaveBeenCalledTimes(1);
  });

  it('长标题被截断到 40 字符 + 省略号', async () => {
    startTraySync();
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    mockInvoke.mockClear();

    const longTitle = '一二三四五六七八九十'.repeat(5);
    useBilibiliVideosStore.setState({
      ids: ['BV2'],
      entities: { BV2: makeVideo('BV2', longTitle, '某 UP 主') },
    });
    usePlayingListStore.setState({ current: 'BV2' });
    vi.advanceTimersByTime(250);
    await Promise.resolve();

    const labelCall = mockInvoke.mock.calls.find((c) => c[0] === 'tray_set_track_label');
    expect(labelCall).toBeDefined();
    const label = labelCall![1].label as string;
    expect(label.length).toBeLessThanOrEqual(40);
    expect(label.endsWith('…')).toBe(true);
  });

  it('同标签重复变化时去重（不触发额外 invoke）', async () => {
    startTraySync();
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    mockInvoke.mockClear();

    useBilibiliVideosStore.setState({
      ids: ['BV3'],
      entities: { BV3: makeVideo('BV3', 'A', 'B') },
    });
    usePlayingListStore.setState({ current: 'BV3' });
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    const labelCallsAfterFirst = mockInvoke.mock.calls.filter(
      (c) => c[0] === 'tray_set_track_label',
    ).length;

    // 再次触发同样 store 状态，应被去重
    useBilibiliVideosStore.setState({
      ids: ['BV3'],
      entities: { BV3: makeVideo('BV3', 'A', 'B') },
    });
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    const labelCallsAfterSecond = mockInvoke.mock.calls.filter(
      (c) => c[0] === 'tray_set_track_label',
    ).length;

    expect(labelCallsAfterSecond).toBe(labelCallsAfterFirst);
  });
});
