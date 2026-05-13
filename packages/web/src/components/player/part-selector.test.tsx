import { fireEvent, render, screen } from '@testing-library/react';
import {
  usePlayingListStore,
  useVideoPagePrefStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { PartSelector } from './part-selector';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';
import { useUIShell } from '@/stores/ui-shell';

const MULTI: BilibiliVideo = {
  aid: 1,
  bvid: 'BV1Multi00001',
  created: 0,
  length: '',
  pic: '',
  is_union_video: false,
  title: 'Multi',
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

function resetStores() {
  usePlayingListStore.setState({
    favId: '',
    trackIds: [MULTI.bvid],
    current: MULTI.bvid,
    playNext: false,
  });
  usePlayerRuntimeStore.setState({
    progress: 0,
    duration: 0,
    playingPage: 1,
    switchToPage: undefined,
  });
  useVideoPagePrefStore.setState({ defaultPage: {} });
  useUIShell.setState({
    addToFavOpen: false,
    addToFavBvids: [],
    addToFavExcludeId: null,
    addToFavFromSearch: false,
  });
}

describe('PartSelector', () => {
  beforeEach(resetStores);

  it('常态 header 显示当前 P + 总 P + 默认 P（如有）', () => {
    usePlayerRuntimeStore.setState({ playingPage: 2 });
    useVideoPagePrefStore.setState({ defaultPage: { [MULTI.bvid]: 3 } });
    render(<PartSelector video={MULTI} />);
    expect(screen.getByText(/当前 P2/)).toBeInTheDocument();
    expect(screen.getByText(/共 3 P/)).toBeInTheDocument();
    expect(screen.getByText(/默认 P3/)).toBeInTheDocument();
  });

  it('单击 P 行调 switchToPage（常态）', () => {
    const switchToPage = vi.fn();
    usePlayerRuntimeStore.setState({ switchToPage });
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('option', { name: /播放 P3/ }));
    expect(switchToPage).toHaveBeenCalledWith(3);
  });

  it('点 Pin 按钮 toggle 默认 P', () => {
    usePlayerRuntimeStore.setState({ playingPage: 2 });
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('button', { name: /设为默认 P2/ }));
    expect(useVideoPagePrefStore.getState().defaultPage[MULTI.bvid]).toBe(2);
  });

  it('再次点击当前默认行 Pin → 清除', () => {
    useVideoPagePrefStore.setState({ defaultPage: { [MULTI.bvid]: 2 } });
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('button', { name: /清除默认 P2/ }));
    expect(useVideoPagePrefStore.getState().defaultPage[MULTI.bvid]).toBeUndefined();
  });

  it('P1 行 Pin 按钮 disabled', () => {
    render(<PartSelector video={MULTI} />);
    const p1Pin = screen.getByRole('button', { name: /设为默认 P1/ }) as HTMLButtonElement;
    expect(p1Pin).toBeDisabled();
  });

  it('显式 :p<n> 上下文整列 Pin 置灰（disabled）', () => {
    usePlayingListStore.setState({
      trackIds: [`${MULTI.bvid}:p2`],
      current: `${MULTI.bvid}:p2`,
    });
    render(<PartSelector video={MULTI} />);
    const pinButtons = screen.getAllByRole('button', { name: /(设为默认|清除默认)/ });
    pinButtons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('进入多选模式：header 显示已选 0 + 加入歌单按钮 disabled', () => {
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('button', { name: '进入多选模式' }));
    expect(screen.getByText(/已选 0/)).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /加入歌单 \(0\)/ }) as HTMLButtonElement;
    expect(addBtn).toBeDisabled();
  });

  it('多选模式下行点击 = 切勾选；加入歌单 → openAddToFavBatch with trackIds', () => {
    const openAddToFavBatch = vi.fn();
    useUIShell.setState({ openAddToFavBatch });
    const onAfterSubmit = vi.fn();
    render(<PartSelector video={MULTI} onAfterSubmit={onAfterSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: '进入多选模式' }));
    // 多选模式下行 aria-label 应是"选择"前缀
    fireEvent.click(screen.getByRole('option', { name: /选择 P1/ }));
    fireEvent.click(screen.getByRole('option', { name: /选择 P3/ }));

    expect(screen.getByText(/已选 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /加入歌单 \(2\)/ }));

    // P1 → 纯 bvid；P3 → bvid:p3
    expect(openAddToFavBatch).toHaveBeenCalledWith([MULTI.bvid, `${MULTI.bvid}:p3`]);
    expect(onAfterSubmit).toHaveBeenCalled();
  });

  it('多选模式全选 / 反选', () => {
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('button', { name: '进入多选模式' }));
    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    expect(screen.getByText(/已选 3/)).toBeInTheDocument();
    // 再点切换为反选（实际全清空）
    fireEvent.click(screen.getByRole('button', { name: '反选' }));
    expect(screen.getByText(/已选 0/)).toBeInTheDocument();
  });

  it('退出多选模式：header 还原 + 选中清空', () => {
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('button', { name: '进入多选模式' }));
    fireEvent.click(screen.getByRole('option', { name: /选择 P2/ }));
    fireEvent.click(screen.getByRole('button', { name: '退出多选' }));
    expect(screen.getByText(/当前 P/)).toBeInTheDocument();
  });
});
