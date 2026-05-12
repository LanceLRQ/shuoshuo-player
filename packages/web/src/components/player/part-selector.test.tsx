import { fireEvent, render, screen } from '@testing-library/react';
import {
  usePlayingListStore,
  useVideoPagePrefStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { PartSelector } from './part-selector';
import { usePlayerRuntimeStore } from '@/stores/player-runtime';

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
}

describe('PartSelector', () => {
  beforeEach(resetStores);

  it('列出所有 P + 当前 playingPage 高亮（aria-selected=true）', () => {
    usePlayerRuntimeStore.setState({ playingPage: 2 });
    render(<PartSelector video={MULTI} />);
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Verse')).toBeInTheDocument();
    expect(screen.getByText('Outro')).toBeInTheDocument();
    expect(screen.getByText(/当前：P2 \/ 共 3 P/)).toBeInTheDocument();

    const p2 = screen.getByRole('option', { selected: true });
    expect(p2).toHaveTextContent('Verse');
  });

  it('点 P → 调 switchToPage', () => {
    const switchToPage = vi.fn();
    usePlayerRuntimeStore.setState({ switchToPage });
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('option', { name: /分P 1|Intro/i }));
    expect(switchToPage).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('Outro'));
    expect(switchToPage).toHaveBeenLastCalledWith(3);
  });

  it('playingPage >= 2 时"设为默认 P"复选框可用', () => {
    usePlayerRuntimeStore.setState({ playingPage: 2 });
    render(<PartSelector video={MULTI} />);
    const cb = screen.getByRole('checkbox') as HTMLButtonElement;
    expect(cb).not.toBeDisabled();
    expect(screen.getByText(/将 P2 设为该投稿的默认 P/)).toBeInTheDocument();
  });

  it('playingPage=1 时"设为默认 P"置灰（默认 P 是冗余表达）', () => {
    usePlayerRuntimeStore.setState({ playingPage: 1 });
    render(<PartSelector video={MULTI} />);
    const cb = screen.getByRole('checkbox') as HTMLButtonElement;
    expect(cb).toBeDisabled();
  });

  it('显式 :p<n> TrackId 上下文：复选框置灰且文案提示', () => {
    usePlayingListStore.setState({
      trackIds: [`${MULTI.bvid}:p2`],
      current: `${MULTI.bvid}:p2`,
    });
    usePlayerRuntimeStore.setState({ playingPage: 2 });
    render(<PartSelector video={MULTI} />);
    const cb = screen.getByRole('checkbox') as HTMLButtonElement;
    expect(cb).toBeDisabled();
    expect(screen.getByText(/该条目已显式锁定 P/)).toBeInTheDocument();
  });

  it('勾选"设为默认 P" → 写入 useVideoPagePrefStore', () => {
    usePlayerRuntimeStore.setState({ playingPage: 3 });
    render(<PartSelector video={MULTI} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(useVideoPagePrefStore.getState().defaultPage[MULTI.bvid]).toBe(3);
  });

  it('取消"设为默认 P" → 删 key（回到 page 1 语义）', () => {
    useVideoPagePrefStore.setState({ defaultPage: { [MULTI.bvid]: 3 } });
    usePlayerRuntimeStore.setState({ playingPage: 3 });
    render(<PartSelector video={MULTI} />);
    const cb = screen.getByRole('checkbox') as HTMLButtonElement;
    // 初始勾选态：defaultPage[bvid]=3, playingPage=3
    expect(cb.getAttribute('data-state')).toBe('checked');
    fireEvent.click(cb);
    expect(useVideoPagePrefStore.getState().defaultPage[MULTI.bvid]).toBeUndefined();
  });
});
