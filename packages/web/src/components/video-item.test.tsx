import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  usePlayingListStore,
  useUIStore,
  useFavoritesStore,
  useVideoPagePrefStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
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
    trackIds: [],
    current: '',
    playNext: false,
  });
  useUIStore.setState({ notices: [] });
  useFavoritesStore.setState({ entries: {} });
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
    expect(state.trackIds).toContain('BV1Test00001');
    expect(state.current).toBe('BV1Test00001');
    expect(state.playNext).toBe(true);
  });

  it('点击封面 → 触发播放（与右侧按钮原行为一致）', () => {
    render(<VideoItem video={SAMPLE} />);
    // 封面 div 设置了 role="button" + aria-label="播放"
    const cover = screen.getByRole('button', { name: '播放' });
    fireEvent.click(cover);

    const state = usePlayingListStore.getState();
    expect(state.trackIds).toContain('BV1Test00001');
    expect(state.playNext).toBe(true);
  });

  it('favId 存在时双击走 addSingle 而非 setPlaylist', () => {
    const { container } = render(<VideoItem video={SAMPLE} favId="fav-1" />);
    fireEvent.doubleClick(container.firstChild as HTMLElement);

    const state = usePlayingListStore.getState();
    expect(state.trackIds).toEqual(['BV1Test00001']);
    expect(state.playNext).toBe(true);
  });

  it('右侧按钮在非搜索模式下渲染为"收藏"（aria-label=收藏），点击不触发播放', () => {
    render(<VideoItem video={SAMPLE} />);
    const likeBtn = screen.getByRole('button', { name: '收藏' });
    fireEvent.click(likeBtn);
    // 收藏功能不应触发播放
    const state = usePlayingListStore.getState();
    expect(state.trackIds).toEqual([]);
    expect(state.current).toBe('');
  });

  it('点击收藏按钮：未收藏 → 写入 useFavoritesStore.entries[bvid]', () => {
    render(<VideoItem video={SAMPLE} />);
    fireEvent.click(screen.getByRole('button', { name: '收藏' }));
    const entries = useFavoritesStore.getState().entries;
    expect('BV1Test00001' in entries).toBe(true);
    expect(typeof entries['BV1Test00001']).toBe('number');
  });

  it('点击收藏按钮：已收藏 → 移除', () => {
    useFavoritesStore.setState({ entries: { BV1Test00001: 100 } });
    render(<VideoItem video={SAMPLE} />);
    fireEvent.click(screen.getByRole('button', { name: '收藏' }));
    expect('BV1Test00001' in useFavoritesStore.getState().entries).toBe(false);
  });

  it('已收藏时 Star 图标含 fill-current 与 text-yellow-500 样式类', () => {
    useFavoritesStore.setState({ entries: { BV1Test00001: 100 } });
    const { container } = render(<VideoItem video={SAMPLE} />);
    const likeBtn = screen.getByRole('button', { name: '收藏' });
    const svg = likeBtn.querySelector('svg');
    expect(svg?.getAttribute('class')).toMatch(/fill-current/);
    expect(svg?.getAttribute('class')).toMatch(/text-yellow-500/);
    // 未收藏的 SAMPLE2 不应该带 fill-current
    void container;
  });

  it('未收藏时 Star 图标不含 fill-current', () => {
    const { container } = render(<VideoItem video={SAMPLE} />);
    const likeBtn = screen.getByRole('button', { name: '收藏' });
    const svg = likeBtn.querySelector('svg');
    expect(svg?.getAttribute('class')).not.toMatch(/fill-current/);
    void container;
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
    expect(state.trackIds).toEqual([]);
  });

  it('selectMode 下双击不触发播放、封面无 role=button', () => {
    const onToggleSelect = vi.fn();
    const { container } = render(
      <VideoItem video={SAMPLE} selectMode onToggleSelect={onToggleSelect} />,
    );
    fireEvent.doubleClick(container.firstChild as HTMLElement);
    expect(usePlayingListStore.getState().trackIds).toEqual([]);
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

describe('VideoItem: 多 P 投稿操作菜单（D3）', () => {
  const MULTI: BilibiliVideo = {
    ...SAMPLE,
    bvid: 'BV1Multi00001',
    videos: 3,
    pages: [
      { cid: 100, page: 1, part: 'Intro', duration: 60 },
      { cid: 101, page: 2, part: 'Verse', duration: 90 },
      { cid: 102, page: 3, part: 'Outro', duration: 30 },
    ],
  };

  beforeEach(() => {
    reset();
    useVideoPagePrefStore.setState({ defaultPage: {} });
    useUIShell.setState({
      addToFavOpen: false,
      addToFavBvids: [],
      addToFavExcludeId: null,
      addToFavFromSearch: false,
    });
  });

  it('单 P 投稿打开菜单后不渲染"选择分 P 添加到歌单"sub menu', async () => {
    const user = userEvent.setup();
    render(<VideoItem video={SAMPLE} />);
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.queryByText('选择分 P 添加到歌单')).not.toBeInTheDocument();
  });

  it('多 P 投稿菜单含"选择分 P 添加到歌单"与"记住默认 P"', async () => {
    const user = userEvent.setup();
    render(<VideoItem video={MULTI} />);
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.getByText('选择分 P 添加到歌单')).toBeInTheDocument();
    expect(screen.getByText(/记住默认 P/)).toBeInTheDocument();
  });

  it('sub menu 展开后渲染所有 P 与时长', async () => {
    const user = userEvent.setup();
    render(<VideoItem video={MULTI} />);
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    await user.hover(screen.getByText('选择分 P 添加到歌单'));
    // sub menu 中应能找到 P1/P2/P3 三项标题
    expect(await screen.findByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Verse')).toBeInTheDocument();
    expect(screen.getByText('Outro')).toBeInTheDocument();
  });

  it('已有默认 P 时，标题显示"当前 P{n}"且 sub menu 列出"清除"项', async () => {
    const user = userEvent.setup();
    useVideoPagePrefStore.setState({ defaultPage: { BV1Multi00001: 2 } });
    render(<VideoItem video={MULTI} />);
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.getByText(/记住默认 P（当前 P2）/)).toBeInTheDocument();
    await user.hover(screen.getByText(/记住默认 P/));
    expect(await screen.findByText('清除默认 P 设置')).toBeInTheDocument();
  });

  it('无默认 P 时菜单标题不带括号', async () => {
    const user = userEvent.setup();
    render(<VideoItem video={MULTI} />);
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    // 标题文案恰好是"记住默认 P"（不带括号）
    const trigger = screen.getByText('记住默认 P');
    expect(trigger).toBeInTheDocument();
  });

  it('标题左侧渲染 "{N}P" 总数 Badge（仅多 P 视频）', () => {
    render(<VideoItem video={MULTI} />);
    const badge = screen.getByLabelText('共 3 分 P');
    expect(badge).toHaveTextContent('3P');
  });

  it('单 P 视频不渲染标题左侧 Badge', () => {
    render(<VideoItem video={SAMPLE} />);
    expect(screen.queryByLabelText(/共 \d+ 分 P/)).toBeNull();
  });
});
