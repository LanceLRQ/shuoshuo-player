import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  LyricApi,
  resetPlatformBridge,
  setPlatformBridge,
  useLyricsStore,
  useUIStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { LyricViewer } from './lyric-viewer';
import { useUIShell } from '@/stores/ui-shell';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    LyricApi: { getLyricByBvid: vi.fn() },
  };
});
const mockedGetLyric = vi.mocked(LyricApi.getLyricByBvid);

// react-lrc 在 jsdom 下不能正常运行；mock 简化输出
vi.mock('react-lrc', () => ({
  Lrc: ({ lrc }: { lrc: string }) => <div data-testid="lrc-mock">{lrc}</div>,
}));

// useMusicPlayer 涉及 Howler / Audio 等副作用，全 mock 为 module-level 可变对象，
// 让测试通过修改 mockPlayerState 控制 currentVideo / progress
const mockPlayerState: {
  currentVideo: BilibiliVideo | null;
  progress: number;
} = { currentVideo: null, progress: 0 };
vi.mock('@/hooks/use-music-player', () => ({
  useMusicPlayer: () => mockPlayerState,
}));

const SAMPLE_VIDEO: BilibiliVideo = {
  aid: 1,
  bvid: 'BV1Test00001',
  created: 0,
  length: '00:30',
  pic: '',
  is_union_video: false,
  title: '测试',
  sub_title: '',
  play: 0,
  comment: 0,
  author: 'X',
  description: '',
  mid: 1,
};

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterAll(() => {
  vi.unstubAllGlobals();
  resetPlatformBridge();
});

function reset() {
  useLyricsStore.setState({ lyricMaps: {} });
  useUIStore.setState({ notices: [] });
  useUIShell.setState({ showLyric: true });
  mockPlayerState.currentVideo = SAMPLE_VIDEO;
  mockPlayerState.progress = 0;
  mockedGetLyric.mockReset();
  setPlatformBridge({
    type: 'web',
    storage: {
      getItem: vi.fn(async () => null),
      setItem: vi.fn(async () => {}),
      removeItem: vi.fn(async () => {}),
    },
    auth: {
      login: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
      onLoginSuccess: vi.fn(),
    },
    shell: { openExternal: vi.fn(async () => {}) },
  });
}

describe('LyricViewer', () => {
  beforeEach(() => {
    reset();
  });

  it('显示当前曲目标题', () => {
    render(<LyricViewer />);
    expect(screen.getByText('测试')).toBeInTheDocument();
  });

  it('currentVideo=null 时显示"未播放"', () => {
    mockPlayerState.currentVideo = null;
    render(<LyricViewer />);
    expect(screen.getByText('未播放')).toBeInTheDocument();
  });

  it('点击关闭按钮触发 useUIShell.closeLyric()', () => {
    render(<LyricViewer />);
    expect(useUIShell.getState().showLyric).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '关闭歌词' }));
    expect(useUIShell.getState().showLyric).toBe(false);
  });

  it('Lrc 组件接收当前歌词文本（lyricMaps[bvid].lyricText）', () => {
    useLyricsStore.setState({
      lyricMaps: {
        BV1Test00001: { bvid: 'BV1Test00001', lyricText: '[00:00]Hello', offset: 0 },
      },
    });
    render(<LyricViewer />);
    expect(screen.getByTestId('lrc-mock').textContent).toBe('[00:00]Hello');
  });

  it('点击 -/+ 按钮调整 offset（updateLyric 被调用）', () => {
    useLyricsStore.setState({
      lyricMaps: {
        BV1Test00001: { bvid: 'BV1Test00001', lyricText: '[00:00]X', offset: 0 },
      },
    });
    render(<LyricViewer />);

    const stepInput = screen.getByLabelText('偏移步长 ms') as HTMLInputElement;
    expect(stepInput.value).toBe('500');

    const buttons = screen.getAllByRole('button');
    // 第一个按钮是关闭，第二个是 minus，第三个是 plus
    fireEvent.click(buttons[1]);
    expect(useLyricsStore.getState().lyricMaps.BV1Test00001.offset).toBe(-500);

    fireEvent.change(stepInput, { target: { value: '200' } });
    fireEvent.click(buttons[2]);
    expect(useLyricsStore.getState().lyricMaps.BV1Test00001.offset).toBe(-300);
  });

  it('刷新云端歌词成功 → updateLyric + 通知', async () => {
    mockedGetLyric.mockResolvedValueOnce({ content: '[00:00]Cloud', id: 99 } as never);
    render(<LyricViewer />);

    const buttons = screen.getAllByRole('button');
    // refresh 是第 4 个按钮
    fireEvent.click(buttons[3]);

    await waitFor(() => {
      expect(useLyricsStore.getState().lyricMaps.BV1Test00001.lyricText).toBe('[00:00]Cloud');
    });
  });

  it('云端无歌词 → 不弹 toast（避免打扰；UI 显示"暂无歌词"已足够）', async () => {
    mockedGetLyric.mockResolvedValueOnce({ content: '' } as never);
    render(<LyricViewer />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[3]);

    await waitFor(() => expect(mockedGetLyric).toHaveBeenCalled());
    expect(useUIStore.getState().notices).toEqual([]);
  });

  it('云端 API 失败 → 不弹 toast（歌词降级为软失败，不打扰用户）', async () => {
    mockedGetLyric.mockRejectedValueOnce(new Error('network'));
    render(<LyricViewer />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[3]);

    await waitFor(() => expect(mockedGetLyric).toHaveBeenCalled());
    expect(useUIStore.getState().notices).toEqual([]);
  });

  it('点击编辑按钮触发 onEdit prop', () => {
    const onEdit = vi.fn();
    render(<LyricViewer onEdit={onEdit} />);
    const buttons = screen.getAllByRole('button');
    // 编辑是第 5 个按钮
    fireEvent.click(buttons[4]);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('children prop 优先于默认 Lrc 渲染', () => {
    render(
      <LyricViewer>
        <div data-testid="custom-content">自定义内容</div>
      </LyricViewer>,
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.queryByTestId('lrc-mock')).not.toBeInTheDocument();
  });
});
