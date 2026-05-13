import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import {
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  useFavListStore,
  usePlayingListStore,
  useUIStore,
  FavListType,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { AddToFavDialog } from './add-to-fav-dialog';

function makeFav(id: string, name: string, type: FavListType, bv_ids: string[] = []) {
  return {
    id,
    name,
    type,
    bv_ids,
    create_time: 0,
    update_time: 0,
  } as never;
}

function reset() {
  useUIShell.setState({
    addToFavOpen: false,
    addToFavBvids: [],
    addToFavExcludeId: null,
    addToFavFromSearch: false,
  });
  useFavListStore.setState({ list: [] });
  useBilibiliVideosStore.setState({ ids: [], entities: {} });
  useUIStore.setState({ notices: [] });
}

describe('AddToFavDialog', () => {
  beforeEach(() => {
    reset();
  });

  it('未打开时不渲染', () => {
    render(<AddToFavDialog />);
    expect(screen.queryByText('添加到歌单')).not.toBeInTheDocument();
  });

  it('已知视频显示 title，未知视频显示 bvid', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: {
        BV1: { bvid: 'BV1', title: '测试视频' } as never,
      },
    });
    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1'));
    expect(screen.getByText('测试视频')).toBeInTheDocument();
  });

  it('无 CUSTOM 歌单时显示空状态', () => {
    useFavListStore.setState({
      list: [makeFav('u1', 'UP 主', FavListType.UPLOADER)],
    });
    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1'));

    expect(screen.getByText(/暂无可添加的自定义歌单/)).toBeInTheDocument();
  });

  it('选中 CUSTOM 歌单 → 确认添加 → addFavVideo + 通知', async () => {
    const addFavVideo = vi.fn();
    useFavListStore.setState({
      list: [
        makeFav('c1', 'My Songs', FavListType.CUSTOM),
        makeFav('c2', 'Other', FavListType.CUSTOM),
        makeFav('u1', 'UP', FavListType.UPLOADER),
      ],
      addFavVideo,
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1'));

    // UPLOADER 类型不应渲染为可选项
    expect(screen.getByText('My Songs')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.queryByText('UP')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('My Songs').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));

    expect(addFavVideo).toHaveBeenCalledWith('c1', 'BV1');
    await waitFor(() => {
      expect(useUIShell.getState().addToFavOpen).toBe(false);
    });
    expect(
      useUIStore.getState().notices.find((n) => /已添加到 1 个歌单/.test(n.message)),
    ).toBeDefined();
  });

  it('excludeFavId 对应歌单 disabled + 显示"已包含"标记', () => {
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
    });
    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1', { excludeFavId: 'c1' }));

    expect(screen.getByText('已包含')).toBeInTheDocument();
    const btn = screen.getByText('My Songs').closest('button')!;
    expect(btn).toBeDisabled();
  });

  it('fromSearch=true + 视频未在 store → 调用 getVideoByBvid', async () => {
    const getVideoByBvid = vi.fn(async () => true);
    useBilibiliUserVideosStore.setState({ getVideoByBvid });
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV-NEW', { fromSearch: true }));

    await waitFor(() => {
      expect(getVideoByBvid).toHaveBeenCalledWith('BV-NEW');
    });
  });

  it('点击取消关闭对话框', async () => {
    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1'));

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => {
      expect(useUIShell.getState().addToFavOpen).toBe(false);
    });
  });

  it('selected 为空时确认按钮 disabled', () => {
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
    });
    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1'));

    expect(screen.getByRole('button', { name: '确认添加' })).toBeDisabled();
  });

  it('单 P 投稿：不显示"整投稿/指定 P" RadioGroup（D2）', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1'],
      entities: { BV1: { bvid: 'BV1', title: '单 P', videos: 1 } as never },
    });
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
    });
    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1'));
    expect(screen.queryByText('将什么加入歌单？')).not.toBeInTheDocument();
  });

  it('多 P 投稿 + 当前播放 P>=2：显示 RadioGroup，默认"整投稿"', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Multi'],
      entities: {
        BV1Multi: {
          bvid: 'BV1Multi',
          title: '多 P',
          videos: 3,
          pages: [
            { cid: 1, page: 1, part: 'A', duration: 0 },
            { cid: 2, page: 2, part: 'B', duration: 0 },
            { cid: 3, page: 3, part: 'C', duration: 0 },
          ],
        } as never,
      },
    });
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
    });
    // 当前播放 BV1Multi 的 P2
    usePlayingListStore.setState({
      favId: '',
      trackIds: ['BV1Multi'],
      current: 'BV1Multi',
      playNext: false,
    });
    usePlayerRuntimeStore.setState({ playingPage: 2, progress: 0, duration: 0 });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1Multi'));

    expect(screen.getByText('将什么加入歌单？')).toBeInTheDocument();
    // 默认选中"整投稿"（因为入参不含 :p<n>）
    const videoMode = screen.getByRole('radio', { name: /整个投稿/ }) as HTMLButtonElement;
    expect(videoMode.getAttribute('data-state')).toBe('checked');
    // "仅 P2 · B" 选项存在
    expect(screen.getByText(/仅 P2/)).toBeInTheDocument();
    expect(screen.getByText(/· B/)).toBeInTheDocument();
  });

  it('入参含 :p<n>：默认选中"指定 P"模式，提交写入 :p<n> trackId', async () => {
    const addFavVideo = vi.fn();
    useBilibiliVideosStore.setState({
      ids: ['BV1Multi'],
      entities: {
        BV1Multi: {
          bvid: 'BV1Multi',
          title: 'M',
          videos: 3,
          pages: [
            { cid: 1, page: 1, part: 'A', duration: 0 },
            { cid: 2, page: 2, part: 'B', duration: 0 },
            { cid: 3, page: 3, part: 'C', duration: 0 },
          ],
        } as never,
      },
    });
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
      addFavVideo,
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1Multi:p3'));

    // 默认指定 P 模式
    const pageMode = screen.getByRole('radio', { name: /仅 P3/ }) as HTMLButtonElement;
    expect(pageMode.getAttribute('data-state')).toBe('checked');

    fireEvent.click(screen.getByText('My Songs').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));

    expect(addFavVideo).toHaveBeenCalledWith('c1', 'BV1Multi:p3');
  });

  it('多 P 投稿入参纯 bvid 但当前播放 P=1：不显示 RadioGroup（无指定 P 可选）', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Multi'],
      entities: {
        BV1Multi: {
          bvid: 'BV1Multi',
          title: 'M',
          videos: 2,
          pages: [
            { cid: 1, page: 1, part: 'A', duration: 0 },
            { cid: 2, page: 2, part: 'B', duration: 0 },
          ],
        } as never,
      },
    });
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
    });
    // 当前不在播放该投稿 → targetPage fallback 1，不显示
    usePlayingListStore.setState({
      favId: '',
      trackIds: [],
      current: '',
      playNext: false,
    });
    usePlayerRuntimeStore.setState({ playingPage: 1, progress: 0, duration: 0 });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1Multi'));

    expect(screen.queryByText('将什么加入歌单？')).not.toBeInTheDocument();
  });

  it('指定 P 模式 + 仅 UPLOADER/BILI_FAV 歌单存在 → 显示"暂无可添加的自定义歌单"（F5）', () => {
    // §5.4 设计：UPLOADER/BILI_FAV 不接受 :p<n>，dialog 列表仅渲染 CUSTOM；
    // 当无 CUSTOM 歌单时，多 P 上下文也走"空状态"分支
    useBilibiliVideosStore.setState({
      ids: ['BV1Multi'],
      entities: {
        BV1Multi: {
          bvid: 'BV1Multi',
          title: 'M',
          videos: 2,
          pages: [
            { cid: 1, page: 1, part: '', duration: 0 },
            { cid: 2, page: 2, part: '', duration: 0 },
          ],
        } as never,
      },
    });
    useFavListStore.setState({
      list: [
        makeFav('u1', 'UP 主歌单', FavListType.UPLOADER),
        makeFav('b1', 'B 站收藏夹', FavListType.BILI_FAV),
      ],
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1Multi:p2'));

    // dialog 显示空状态文案（UPLOADER / BILI_FAV 不渲染为可选项）
    expect(screen.getByText(/暂无可添加的自定义歌单/)).toBeInTheDocument();
    expect(screen.queryByText('UP 主歌单')).not.toBeInTheDocument();
    expect(screen.queryByText('B 站收藏夹')).not.toBeInTheDocument();
  });

  it('多 P 投稿 + 切换到"仅 P{n}"模式后提交 → 写入 bvid:p<n>', async () => {
    const addFavVideo = vi.fn();
    useBilibiliVideosStore.setState({
      ids: ['BV1Multi'],
      entities: {
        BV1Multi: {
          bvid: 'BV1Multi',
          title: 'M',
          videos: 2,
          pages: [
            { cid: 1, page: 1, part: '', duration: 0 },
            { cid: 2, page: 2, part: '', duration: 0 },
          ],
        } as never,
      },
    });
    useFavListStore.setState({
      list: [makeFav('c1', 'My Songs', FavListType.CUSTOM)],
      addFavVideo,
    });
    usePlayingListStore.setState({
      favId: '',
      trackIds: ['BV1Multi'],
      current: 'BV1Multi',
      playNext: false,
    });
    usePlayerRuntimeStore.setState({ playingPage: 2, progress: 0, duration: 0 });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1Multi'));

    // 切换到 "仅 P2"
    fireEvent.click(screen.getByRole('radio', { name: /仅 P2/ }));
    fireEvent.click(screen.getByText('My Songs').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));

    expect(addFavVideo).toHaveBeenCalledWith('c1', 'BV1Multi:p2');
  });

  it('单条模式：目标歌单已含 writeTrackId → 禁用 + 显示"已包含"', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Multi'],
      entities: {
        BV1Multi: {
          bvid: 'BV1Multi',
          title: 'M',
          videos: 2,
          pages: [
            { cid: 1, page: 1, part: '', duration: 0 },
            { cid: 2, page: 2, part: '', duration: 0 },
          ],
        } as never,
      },
    });
    useFavListStore.setState({
      list: [
        makeFav('c1', 'Already Has', FavListType.CUSTOM, ['BV1Multi:p2']),
        makeFav('c2', 'Empty', FavListType.CUSTOM, []),
      ],
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1Multi:p2'));

    const alreadyBtn = screen.getByText('Already Has').closest('button') as HTMLButtonElement;
    const emptyBtn = screen.getByText('Empty').closest('button') as HTMLButtonElement;
    expect(alreadyBtn).toBeDisabled();
    expect(emptyBtn).not.toBeDisabled();
    expect(screen.getByText('已包含')).toBeInTheDocument();
  });

  it('单条多 P 模式切换：切到"整投稿"后禁用态按纯 bvid 重算', () => {
    useBilibiliVideosStore.setState({
      ids: ['BV1Multi'],
      entities: {
        BV1Multi: {
          bvid: 'BV1Multi',
          title: 'M',
          videos: 2,
          pages: [
            { cid: 1, page: 1, part: '', duration: 0 },
            { cid: 2, page: 2, part: '', duration: 0 },
          ],
        } as never,
      },
    });
    useFavListStore.setState({
      list: [
        // 歌单已含 :p2 但没有纯 bvid
        makeFav('c1', 'Has Page Only', FavListType.CUSTOM, ['BV1Multi:p2']),
      ],
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFav('BV1Multi:p2'));
    // 默认"仅 P2"模式 → c1 已包含禁用
    expect(screen.getByText('Has Page Only').closest('button')).toBeDisabled();

    // 切到"整投稿"模式 → writeTrackId 变为纯 bvid，c1 不含 → 启用
    fireEvent.click(screen.getByRole('radio', { name: /整个投稿/ }));
    expect(screen.getByText('Has Page Only').closest('button')).not.toBeDisabled();
  });

  it('批量模式：歌单完全包含所有待添加项 → 禁用 + 显示"已全部包含"', () => {
    useFavListStore.setState({
      list: [
        makeFav('c1', 'Full Coverage', FavListType.CUSTOM, ['BVa', 'BVb', 'BVc']),
        makeFav('c2', 'Partial', FavListType.CUSTOM, ['BVa']),
        makeFav('c3', 'None', FavListType.CUSTOM, []),
      ],
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFavBatch(['BVa', 'BVb']));

    expect(screen.getByText('Full Coverage').closest('button')).toBeDisabled();
    expect(screen.getByText('已全部包含')).toBeInTheDocument();
    // 部分包含仍允许（store 内部去重）
    expect(screen.getByText('Partial').closest('button')).not.toBeDisabled();
    expect(screen.getByText('None').closest('button')).not.toBeDisabled();
  });

  it('批量模式：标题/描述切换 + 提交调用 addFavVideoByBvids', async () => {
    const addFavVideoByBvids = vi.fn(async () => ({ success: 3, failed: 0 }));
    useFavListStore.setState({
      list: [
        makeFav('c1', 'My Songs', FavListType.CUSTOM),
        makeFav('c2', 'Other', FavListType.CUSTOM),
      ],
      addFavVideoByBvids,
    });

    render(<AddToFavDialog />);
    act(() => useUIShell.getState().openAddToFavBatch(['BV1', 'BV2', 'BV3'], { fromSearch: true }));

    expect(screen.getByText('批量添加到歌单')).toBeInTheDocument();
    expect(screen.getByText('已选 3 首歌曲')).toBeInTheDocument();

    fireEvent.click(screen.getByText('My Songs').closest('button')!);
    fireEvent.click(screen.getByText('Other').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));

    await waitFor(() => {
      expect(addFavVideoByBvids).toHaveBeenCalledWith('c1', ['BV1', 'BV2', 'BV3']);
      expect(addFavVideoByBvids).toHaveBeenCalledWith('c2', ['BV1', 'BV2', 'BV3']);
    });
    await waitFor(() => {
      expect(useUIShell.getState().addToFavOpen).toBe(false);
    });
  });
});
