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
});
