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

  it('双击行（无 favId）→ setPlaylist + playNext=true', () => {
    const { container } = render(<VideoItem video={SAMPLE} />);
    const root = container.firstChild as HTMLElement;
    fireEvent.doubleClick(root);

    const state = usePlayingListStore.getState();
    expect(state.bvIds).toContain('BV1Test00001');
    expect(state.current).toBe('BV1Test00001');
    expect(state.playNext).toBe(true);
  });

  it('点击封面 → 触发播放（与右侧按钮原行为一致）', () => {
    render(<VideoItem video={SAMPLE} />);
    // 封面 div 设置了 role="button" + aria-label="播放"
    const cover = screen.getByRole('button', { name: '播放' });
    fireEvent.click(cover);

    const state = usePlayingListStore.getState();
    expect(state.bvIds).toContain('BV1Test00001');
    expect(state.playNext).toBe(true);
  });

  it('favId 存在时双击走 addSingle 而非 setPlaylist', () => {
    const { container } = render(<VideoItem video={SAMPLE} favId="fav-1" />);
    fireEvent.doubleClick(container.firstChild as HTMLElement);

    const state = usePlayingListStore.getState();
    expect(state.bvIds).toEqual(['BV1Test00001']);
    expect(state.playNext).toBe(true);
  });

  it('右侧按钮在非搜索模式下渲染为"收藏"（aria-label=收藏），点击不触发播放', () => {
    render(<VideoItem video={SAMPLE} />);
    const likeBtn = screen.getByRole('button', { name: '收藏' });
    fireEvent.click(likeBtn);
    // 收藏功能未实装，不应触发播放
    const state = usePlayingListStore.getState();
    expect(state.bvIds).toEqual([]);
    expect(state.current).toBe('');
  });

  it('fromSearch=true 时主按钮调用 onAddToFav 而非播放', () => {
    const onAddToFav = vi.fn();
    render(<VideoItem video={SAMPLE} fromSearch onAddToFav={onAddToFav} />);
    fireEvent.click(screen.getAllByRole('button')[0]); // 第一个 ghost 按钮（添加到歌单）
    expect(onAddToFav).toHaveBeenCalledWith(SAMPLE, true);
  });

  it('fromSearch=true 时双击行不触发播放（避免与添加到歌单语义冲突）', () => {
    const { container } = render(<VideoItem video={SAMPLE} fromSearch onAddToFav={vi.fn()} />);
    fireEvent.doubleClick(container.firstChild as HTMLElement);
    const state = usePlayingListStore.getState();
    expect(state.bvIds).toEqual([]);
  });

  it('selectMode 下双击不触发播放、封面无 role=button', () => {
    const onToggleSelect = vi.fn();
    const { container } = render(
      <VideoItem video={SAMPLE} selectMode onToggleSelect={onToggleSelect} />,
    );
    fireEvent.doubleClick(container.firstChild as HTMLElement);
    expect(usePlayingListStore.getState().bvIds).toEqual([]);
    expect(screen.queryByRole('button', { name: '播放' })).toBeNull();
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
