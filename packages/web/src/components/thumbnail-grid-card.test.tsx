import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { BilibiliVideo } from '@shuoshuo-player/shared';
import { ThumbnailGridCard } from './thumbnail-grid-card';

// mock context-menu：子组件直出 children，Item 用 click 触发 onSelect，规避 Radix portal/pointer
vi.mock('@/components/ui/context-menu', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ContextMenu: Pass,
    ContextMenuTrigger: Pass,
    ContextMenuContent: Pass,
    ContextMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => (
      <button type="button" onClick={() => onSelect?.()}>
        {children}
      </button>
    ),
    ContextMenuSeparator: () => <hr />,
    ContextMenuSub: Pass,
    ContextMenuSubTrigger: Pass,
    ContextMenuSubContent: Pass,
  };
});

// mock hook：返回可控 actions，聚焦卡片的菜单项渲染/派发
const mockActions = vi.hoisted(() => ({
  effectiveTrackId: 'BV1',
  isFavored: false,
  isMultiPart: false,
  partItems: [] as Array<{ key: number; page: number; part?: string }>,
  defaultPage: 1,
  toggleLike: vi.fn(),
  addToPlay: vi.fn(),
  addToFav: vi.fn(),
  openPagesPicker: vi.fn(),
  pinDefaultPage: vi.fn(),
  openBilibili: vi.fn(),
}));
vi.mock('@/hooks/use-video-item-actions', () => ({
  useVideoItemActions: () => mockActions,
}));

function makeVideo(overrides: Partial<BilibiliVideo> = {}): BilibiliVideo {
  return { bvid: 'BV1', title: 'Track', videos: 1, ...overrides } as BilibiliVideo;
}

describe('ThumbnailGridCard 右键菜单', () => {
  beforeEach(() => {
    mockActions.isFavored = false;
    mockActions.isMultiPart = false;
    mockActions.partItems = [];
    mockActions.defaultPage = 1;
    vi.clearAllMocks();
  });

  it('单 P 不渲染分 P 相关菜单项', () => {
    render(<ThumbnailGridCard video={makeVideo()} onClick={vi.fn()} />);
    expect(screen.queryByText('选择分 P 添加到歌单')).not.toBeInTheDocument();
    expect(screen.queryByText(/记住默认 P/)).not.toBeInTheDocument();
  });

  it('多 P 渲染分 P 菜单项', () => {
    mockActions.isMultiPart = true;
    mockActions.partItems = [
      { key: 1, page: 1 },
      { key: 2, page: 2 },
    ];
    render(<ThumbnailGridCard video={makeVideo({ videos: 2 })} onClick={vi.fn()} />);
    expect(screen.getByText('选择分 P 添加到歌单')).toBeInTheDocument();
    expect(screen.getByText(/记住默认 P/)).toBeInTheDocument();
  });

  it('无 onRemove 不渲染移除项；有 onRemove 渲染并可触发', () => {
    const { rerender } = render(<ThumbnailGridCard video={makeVideo()} onClick={vi.fn()} />);
    expect(screen.queryByText('移除歌曲')).not.toBeInTheDocument();

    const onRemove = vi.fn();
    rerender(<ThumbnailGridCard video={makeVideo()} onClick={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByText('移除歌曲'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('点收藏触发 toggleLike，点菜单播放触发 onClick', () => {
    const onClick = vi.fn();
    render(<ThumbnailGridCard video={makeVideo()} onClick={onClick} />);
    fireEvent.click(screen.getByText('收藏'));
    expect(mockActions.toggleLike).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('播放'));
    expect(onClick).toHaveBeenCalled();
  });

  it('isFavored=true 时显示「取消收藏」', () => {
    mockActions.isFavored = true;
    render(<ThumbnailGridCard video={makeVideo()} onClick={vi.fn()} />);
    expect(screen.getByText('取消收藏')).toBeInTheDocument();
  });
});
