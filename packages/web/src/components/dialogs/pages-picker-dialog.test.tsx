import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { type BilibiliVideo } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { PagesPickerDialog } from './pages-picker-dialog';

const MULTI: BilibiliVideo = {
  aid: 1,
  bvid: 'BV1Multi00001',
  created: 0,
  length: '',
  pic: '',
  is_union_video: false,
  title: '多 P 合集',
  sub_title: '',
  play: 0,
  comment: 0,
  author: '',
  description: '',
  videos: 3,
  pages: [
    { cid: 100, page: 1, part: 'Intro', duration: 60 },
    { cid: 101, page: 2, part: 'Verse', duration: 90 },
    { cid: 102, page: 3, part: 'Outro', duration: 30 },
  ],
};

function reset() {
  useUIShell.setState({
    pagesPickerOpen: false,
    pagesPickerVideo: null,
    addToFavOpen: false,
    addToFavBvids: [],
    addToFavExcludeId: null,
    addToFavFromSearch: false,
  });
}

describe('PagesPickerDialog', () => {
  beforeEach(reset);

  it('store flag 关闭时不渲染', () => {
    render(<PagesPickerDialog />);
    expect(screen.queryByText('选择分 P 添加到歌单')).not.toBeInTheDocument();
  });

  it('打开后显示标题 + 投稿标题 + 共 N P', () => {
    render(<PagesPickerDialog />);
    act(() => useUIShell.getState().openPagesPicker(MULTI));
    expect(screen.getByText('选择分 P 添加到歌单')).toBeInTheDocument();
    expect(screen.getByText('多 P 合集')).toBeInTheDocument();
    expect(screen.getByText(/共 3 P/)).toBeInTheDocument();
  });

  it('单选切勾：点行 → 选中 + "已选 N" 计数同步', () => {
    render(<PagesPickerDialog />);
    act(() => useUIShell.getState().openPagesPicker(MULTI));
    fireEvent.click(screen.getByRole('option', { name: /选择 P2/ }));
    expect(screen.getByText(/已选 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /选择 P3/ }));
    expect(screen.getByText(/已选 2/)).toBeInTheDocument();
  });

  it('全选 / 取消全选', () => {
    render(<PagesPickerDialog />);
    act(() => useUIShell.getState().openPagesPicker(MULTI));
    fireEvent.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(screen.getByText(/已选 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '取消全选' }));
    expect(screen.getByText(/已选 0/)).toBeInTheDocument();
  });

  it('提交：openAddToFavBatch 收到 sorted trackIds（P1 转纯 bvid）', async () => {
    const openAddToFavBatch = vi.fn();
    useUIShell.setState({ openAddToFavBatch });
    render(<PagesPickerDialog />);
    act(() => useUIShell.getState().openPagesPicker(MULTI));

    fireEvent.click(screen.getByRole('option', { name: /选择 P3/ }));
    fireEvent.click(screen.getByRole('option', { name: /选择 P1/ }));
    fireEvent.click(screen.getByRole('button', { name: /添加 \(2\)/ }));

    // 按 page 升序排序：P1 → 纯 bvid，P3 → bvid:p3
    expect(openAddToFavBatch).toHaveBeenCalledWith([MULTI.bvid, `${MULTI.bvid}:p3`]);
    await waitFor(() => expect(useUIShell.getState().pagesPickerOpen).toBe(false));
  });

  it('选中为空时"添加"按钮 disabled', () => {
    render(<PagesPickerDialog />);
    act(() => useUIShell.getState().openPagesPicker(MULTI));
    const btn = screen.getByRole('button', { name: /添加 \(0\)/ }) as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  it('点击取消关闭 dialog', async () => {
    render(<PagesPickerDialog />);
    act(() => useUIShell.getState().openPagesPicker(MULTI));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(useUIShell.getState().pagesPickerOpen).toBe(false));
  });
});
