import { useBilibiliUserVideosStore } from './bilibili-user-videos';

const initial = useBilibiliUserVideosStore.getState();

beforeEach(() => {
  useBilibiliUserVideosStore.setState(initial, true);
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
