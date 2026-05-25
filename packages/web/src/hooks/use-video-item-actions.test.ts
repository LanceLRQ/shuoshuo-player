import { renderHook } from '@testing-library/react';
import {
  usePlayingListStore,
  useUIStore,
  useFavoritesStore,
  useVideoPagePrefStore,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { useVideoItemActions } from './use-video-item-actions';

function makeVideo(overrides: Partial<BilibiliVideo> = {}): BilibiliVideo {
  return {
    bvid: 'BV1',
    title: 'Track',
    videos: 1,
    ...overrides,
  } as BilibiliVideo;
}

describe('useVideoItemActions', () => {
  let addSingle: ReturnType<typeof vi.fn>;
  let openAddToFav: ReturnType<typeof vi.fn>;
  let openPagesPicker: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addSingle = vi.fn();
    openAddToFav = vi.fn();
    openPagesPicker = vi.fn();
    useFavoritesStore.setState({ entries: {} });
    useVideoPagePrefStore.setState({ defaultPage: {} });
    usePlayingListStore.setState({ addSingle });
    useUIStore.setState({ notices: [] });
    useUIShell.setState({ openAddToFav, openPagesPicker });
  });

  it('toggleLike 切换收藏态', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo()));
    expect(result.current.isFavored).toBe(false);
    result.current.toggleLike();
    expect('BV1' in useFavoritesStore.getState().entries).toBe(true);
  });

  it('addToPlay 调 addSingle(trackId, false)', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo()));
    result.current.addToPlay();
    expect(addSingle).toHaveBeenCalledWith('BV1', false);
  });

  it('addToPlay 对失效视频拦截，不调 addSingle', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo({ invalid: true })));
    result.current.addToPlay();
    expect(addSingle).not.toHaveBeenCalled();
  });

  it('addToFav 调 openAddToFav', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo()));
    result.current.addToFav();
    expect(openAddToFav).toHaveBeenCalledWith('BV1', { fromSearch: false });
  });

  it('openPagesPicker 调 useUIShell.openPagesPicker', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo({ videos: 3 })));
    result.current.openPagesPicker();
    expect(openPagesPicker).toHaveBeenCalledTimes(1);
  });

  it('pinDefaultPage 写入默认 P', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo({ videos: 3 })));
    result.current.pinDefaultPage(2);
    expect(useVideoPagePrefStore.getState().defaultPage['BV1']).toBe(2);
  });

  it('单 P 投稿 isMultiPart=false', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo({ videos: 1 })));
    expect(result.current.isMultiPart).toBe(false);
  });

  it('多 P 投稿 isMultiPart=true 且 partItems 按 totalP 生成', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo({ videos: 3 })));
    expect(result.current.isMultiPart).toBe(true);
    expect(result.current.partItems).toHaveLength(3);
  });

  it('显式分 P 时 isMultiPart=false（已锁定 P）', () => {
    const { result } = renderHook(() => useVideoItemActions(makeVideo({ videos: 3 }), 2));
    expect(result.current.isMultiPart).toBe(false);
    expect(result.current.effectiveTrackId).toBe('BV1:p2');
  });
});
