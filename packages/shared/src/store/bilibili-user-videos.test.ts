import { useBilibiliUserVideosStore } from './bilibili-user-videos';
import { useUIStore } from './ui';

vi.mock('../api', async () => {
  return {
    UserApi: {
      getUserVideoList: vi.fn(),
      getMyFavoriteFolderVideos: vi.fn(),
      getUserSpaceInfo: vi.fn(),
    },
    VideoApi: {
      getVideoViewInfo: vi.fn(),
    },
  };
});

const { UserApi } = await import('../api');
const mockedFetchList = UserApi.getUserVideoList as unknown as ReturnType<typeof vi.fn>;

const initial = useBilibiliUserVideosStore.getState();

beforeEach(() => {
  useBilibiliUserVideosStore.setState(initial, true);
  useUIStore.setState({ notices: [] });
  mockedFetchList.mockReset();
});

describe('C2: bilibili-user-videos persistSnapshot', () => {
  it('快照中 isLoading 强制为 false（即使 store 当前正在加载）', () => {
    useBilibiliUserVideosStore.setState({ isLoading: true });
    const snap = useBilibiliUserVideosStore.getState().persistSnapshot();
    expect(snap.isLoading).toBe(false);
  });

  it('快照保留 infos / space / favFolders 字段', () => {
    useBilibiliUserVideosStore.setState({
      isLoading: true,
      infos: {
        '283886865': {
          update_time: 100,
          video_list: [{ bvid: 'BV1', created: 200 } as never],
          count: 1,
          update_type: 'default',
        },
      },
      space: { '283886865': { name: 'crystal', mid: 283886865 } as never },
      favFolders: {},
    });

    const snap = useBilibiliUserVideosStore.getState().persistSnapshot();
    expect(Object.keys(snap)).toEqual(
      expect.arrayContaining(['isLoading', 'infos', 'space', 'favFolders']),
    );
    expect(snap.infos['283886865'].video_list).toHaveLength(1);
    expect(snap.space['283886865'].name).toBe('crystal');
  });

  it('快照不包含函数（即不会把 readUserVideos 等方法序列化）', () => {
    const snap = useBilibiliUserVideosStore.getState().persistSnapshot() as unknown as Record<
      string,
      unknown
    >;
    for (const v of Object.values(snap)) {
      expect(typeof v).not.toBe('function');
    }
  });

  it('快照不包含瞬态进度字段 loaded / progressTotal', () => {
    useBilibiliUserVideosStore.setState({ isLoading: true, loaded: 50, progressTotal: 100 });
    const snap = useBilibiliUserVideosStore.getState().persistSnapshot() as unknown as Record<
      string,
      unknown
    >;
    expect(snap.loaded).toBeUndefined();
    expect(snap.progressTotal).toBeUndefined();
  });
});

describe('C4: incremental 模式默认发开始/结束 toast', () => {
  function seedEntry(bvids: string[]) {
    useBilibiliUserVideosStore.setState({
      infos: {
        '100': {
          update_time: 1,
          video_list: bvids.map((bvid, i) => ({ bvid, created: bvids.length - i })) as never,
          count: bvids.length,
          update_type: 'incremental',
        },
      },
    });
  }

  it('incremental + 0 新增 → 结束时清除开始通知，最终只剩「已是最新」', async () => {
    seedEntry(['BV-A', 'BV-B']);
    mockedFetchList.mockResolvedValue({
      list: {
        vlist: [
          { bvid: 'BV-A', created: 2 },
          { bvid: 'BV-B', created: 1 },
        ],
      },
      page: { count: 2 },
    });

    await useBilibiliUserVideosStore.getState().readUserVideos('100', 'incremental');

    const messages = useUIStore.getState().notices.map((n) => n.message);
    // 开始通知「正在检查更新…」在结束时已被 removeNotice 清除，不与结束通知叠加
    expect(messages.some((m) => /正在检查更新/.test(m))).toBe(false);
    expect(messages.some((m) => /已是最新/.test(m))).toBe(true);
  });

  it('incremental + 3 新增 → 结束通知含「新增 3 首」', async () => {
    seedEntry(['BV-OLD']);
    // 第 1 页 3 个全新 + 1 个旧 → 是分界点（部分已知），merge 后停
    mockedFetchList.mockResolvedValue({
      list: {
        vlist: [
          { bvid: 'BV-N1', created: 5 },
          { bvid: 'BV-N2', created: 4 },
          { bvid: 'BV-N3', created: 3 },
          { bvid: 'BV-OLD', created: 1 },
        ],
      },
      page: { count: 30 },
    });

    await useBilibiliUserVideosStore.getState().readUserVideos('100', 'incremental');

    const messages = useUIStore.getState().notices.map((n) => n.message);
    expect(messages.some((m) => /新增 3 首/.test(m))).toBe(true);
  });

  it('range 模式不发 incremental 风格通知（依赖 MediaLoadingDialog 反馈）', async () => {
    seedEntry(['BV-A']);
    mockedFetchList.mockResolvedValue({
      list: { vlist: [{ bvid: 'BV-A', created: 1 }] },
      page: { count: 1 },
    });

    await useBilibiliUserVideosStore
      .getState()
      .readUserVideos('100', 'range', { fromPage: 1, toPage: 1 });

    const messages = useUIStore.getState().notices.map((n) => n.message);
    expect(messages.some((m) => /正在检查更新/.test(m))).toBe(false);
    expect(messages.some((m) => /已是最新/.test(m))).toBe(false);
  });

  it('incremental + 网络错误 → 只剩错误 toast，开始通知与「已是最新」都被清除/跳过', async () => {
    seedEntry(['BV-A']);
    mockedFetchList.mockRejectedValue(new Error('network down'));

    await useBilibiliUserVideosStore.getState().readUserVideos('100', 'incremental');

    const messages = useUIStore.getState().notices.map((n) => n.message);
    expect(messages.some((m) => /获取投稿列表失败/.test(m))).toBe(true);
    expect(messages.some((m) => /正在检查更新/.test(m))).toBe(false);
    expect(messages.some((m) => /已是最新/.test(m))).toBe(false);
  });
});

describe('C3: cancelRefresh 立即重置加载态', () => {
  it('cancel 后 isLoading=false 且 loaded/progressTotal 归零', () => {
    useBilibiliUserVideosStore.setState({ isLoading: true, loaded: 60, progressTotal: 200 });
    useBilibiliUserVideosStore.getState().cancelRefresh();
    const s = useBilibiliUserVideosStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.loaded).toBe(0);
    expect(s.progressTotal).toBe(0);
  });

  it('cancel 多次调用幂等', () => {
    useBilibiliUserVideosStore.setState({ isLoading: true, loaded: 30, progressTotal: 100 });
    useBilibiliUserVideosStore.getState().cancelRefresh();
    useBilibiliUserVideosStore.getState().cancelRefresh();
    expect(useBilibiliUserVideosStore.getState().isLoading).toBe(false);
  });
});
