import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { useFavListStore, useUIStore } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { AddSongDialog } from './add-song-dialog';

function reset() {
  useUIShell.setState({ addSongOpen: false, addSongTargetFavId: null });
  useUIStore.setState({ notices: [] });
  useFavListStore.setState({ list: [] });
}

describe('AddSongDialog', () => {
  beforeEach(() => {
    reset();
  });

  it('addSongOpen=false 时不渲染', () => {
    render(<AddSongDialog />);
    expect(screen.queryByText('添加歌曲')).not.toBeInTheDocument();
  });

  it('打开后显示标题与计数（初始 0）', () => {
    render(<AddSongDialog />);
    act(() => useUIShell.getState().openAddSong('fav-1'));

    expect(screen.getByText('添加歌曲')).toBeInTheDocument();
    expect(screen.getByText('已识别 0 个 BV 号')).toBeInTheDocument();
  });

  it('粘贴多个 BV 号自动识别（支持去重 + 链接形式）', () => {
    render(<AddSongDialog />);
    act(() => useUIShell.getState().openAddSong('fav-1'));

    const textarea = screen.getByLabelText('BV 号 / 视频链接');
    fireEvent.change(textarea, {
      target: {
        value: 'BV1xx411c7mD https://www.bilibili.com/video/BV1xx411c7mD\nBV2yy411c7mE',
      },
    });

    expect(screen.getByText('已识别 2 个 BV 号')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加 2 首' })).toBeInTheDocument();
  });

  it('未识别到 BV 号时点击"添加 0 首"被 disabled', () => {
    render(<AddSongDialog />);
    act(() => useUIShell.getState().openAddSong('fav-1'));

    fireEvent.change(screen.getByLabelText('BV 号 / 视频链接'), {
      target: { value: 'no bvid here' },
    });
    expect(screen.getByRole('button', { name: '添加 0 首' })).toBeDisabled();
  });

  it('提交触发 addFavVideoByBvids 并关闭对话框', async () => {
    const spy = vi.fn(async () => ({ success: 2, failed: 0 }));
    useFavListStore.setState({ addFavVideoByBvids: spy });

    render(<AddSongDialog />);
    act(() => useUIShell.getState().openAddSong('fav-1'));

    fireEvent.change(screen.getByLabelText('BV 号 / 视频链接'), {
      target: { value: 'BV1xx411c7mD BV2yy411c7mE' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加 2 首' }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('fav-1', ['BV1xx411c7mD', 'BV2yy411c7mE']);
    });
    await waitFor(() => {
      expect(useUIShell.getState().addSongOpen).toBe(false);
    });
  });

  it('点击取消关闭对话框', async () => {
    render(<AddSongDialog />);
    act(() => useUIShell.getState().openAddSong('fav-1'));

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => {
      expect(useUIShell.getState().addSongOpen).toBe(false);
    });
  });

  it('targetFavId=null 时 handleSubmit 立即返回（不调 addFavVideoByBvids）', async () => {
    const spy = vi.fn(async () => ({ success: 0, failed: 0 }));
    useFavListStore.setState({ addFavVideoByBvids: spy });

    render(<AddSongDialog />);
    // 直接打开但不设 targetFavId
    act(() => useUIShell.setState({ addSongOpen: true, addSongTargetFavId: null }));

    fireEvent.change(screen.getByLabelText('BV 号 / 视频链接'), {
      target: { value: 'BV1xx411c7mD' },
    });
    fireEvent.click(screen.getByRole('button', { name: /添加.*首/ }));

    // 等几个 tick
    await new Promise((r) => setTimeout(r, 30));
    expect(spy).not.toHaveBeenCalled();
  });
});
