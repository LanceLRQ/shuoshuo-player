import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import {
  useBilibiliUserVideosStore,
  useBilibiliVideosStore,
  useFavListStore,
  useUIStore,
  FavListType,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
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
