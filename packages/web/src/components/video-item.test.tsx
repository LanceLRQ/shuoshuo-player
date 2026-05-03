import { fireEvent, render, screen } from '@testing-library/react';
import { usePlayingListStore, useUIStore, type BilibiliVideo } from '@shuoshuo-player/shared';
import { VideoItem } from './video-item';

const SAMPLE: BilibiliVideo = {
  aid: 1,
  bvid: 'BV1Test00001',
  created: Math.floor(Date.now() / 1000) - 3600,
  length: '00:30',
  pic: 'https://i0.hdslb.com/bfs/archive/x.jpg',
  is_union_video: false,
  title: '测试视频',
  sub_title: '',
  play: 12345,
  comment: 678,
  author: '说说Crystal',
  description: '',
  mid: 1,
};

function reset() {
  usePlayingListStore.setState({
    favId: '',
    bvIds: [],
    current: '',
    playNext: false,
  });
  useUIStore.setState({ notices: [] });
}

describe('VideoItem', () => {
  beforeEach(() => {
    reset();
  });

  it('渲染标题、作者、播放量、评论量', () => {
    render(<VideoItem video={SAMPLE} showAuthor />);
    expect(screen.getByText('测试视频')).toBeInTheDocument();
    expect(screen.getByText('说说Crystal')).toBeInTheDocument();
    // 12345 → "1.2万"
    expect(screen.getByText(/万|12345/)).toBeInTheDocument();
  });

  it('封面图 src 走 bilibiliThumbUrl 200x125 缩略后缀', () => {
    render(<VideoItem video={SAMPLE} />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toMatch(/@200w_125h_1c\.webp$/);
  });

  it('图片 onError 回退到 PlayCircle 占位', () => {
    const { container } = render(<VideoItem video={SAMPLE} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    // PlayCircle 渲染为 svg；fallback 后 img 已被替换
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('isPlaying：current === bvid 时根 div 含 bg-accent class', () => {
    usePlayingListStore.setState({ current: 'BV1Test00001' });
    const { container } = render(<VideoItem video={SAMPLE} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/bg-accent/);
  });

  it('点击立即播放按钮（无 favId）→ setPlaylist + playNext=true', () => {
    render(<VideoItem video={SAMPLE} />);
    // 第一个按钮是 PlayCircle ghost icon button（无 aria-label，靠位置识别）
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    const state = usePlayingListStore.getState();
    expect(state.bvIds).toContain('BV1Test00001');
    expect(state.current).toBe('BV1Test00001');
    expect(state.playNext).toBe(true);
  });

  it('favId 存在时立即播放走 addSingle 而非 setPlaylist', () => {
    render(<VideoItem video={SAMPLE} favId="fav-1" />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    const state = usePlayingListStore.getState();
    expect(state.bvIds).toEqual(['BV1Test00001']);
    expect(state.playNext).toBe(true);
  });

  it('fromSearch=true 时主按钮调用 onAddToFav 而非播放', () => {
    const onAddToFav = vi.fn();
    render(<VideoItem video={SAMPLE} fromSearch onAddToFav={onAddToFav} />);
    fireEvent.click(screen.getAllByRole('button')[0]); // 第一个 ghost 按钮（添加到歌单）
    expect(onAddToFav).toHaveBeenCalledWith(SAMPLE, true);
  });

  it('htmlTitle=true 时 dangerouslySetInnerHTML 渲染 em 高亮', () => {
    const search = { ...SAMPLE, title: '测试 <em>关键词</em> 视频' };
    const { container } = render(<VideoItem video={search} htmlTitle />);
    expect(container.querySelector('em')?.textContent).toBe('关键词');
  });

  it('showRemoveBtn + onRemove 不渲染时菜单不抛错', () => {
    const onRemove = vi.fn();
    expect(() =>
      render(<VideoItem video={SAMPLE} showRemoveBtn onRemove={onRemove} />),
    ).not.toThrow();
  });

  it('createdLabel：fullCreateTime=true 显示完整日期格式', () => {
    render(<VideoItem video={SAMPLE} fullCreateTime />);
    // 完整日期格式 YYYY 年 MM 月 DD 日 HH:mm
    expect(screen.getByText(/年.*月.*日/)).toBeInTheDocument();
  });
});
