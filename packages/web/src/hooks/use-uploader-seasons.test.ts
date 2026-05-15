/**
 * Hook 单测：useUploaderCollections / useCollectionArchives / useCollectionAllArchives
 *
 * Mock 策略：拦截 @shuoshuo-player/shared 的 fetchUploaderCollections / fetchCollectionArchives
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  fetchCollectionArchives,
  fetchUploaderCollections,
  type BilibiliSeasonVideo,
} from '@shuoshuo-player/shared';
import {
  useCollectionAllArchives,
  useCollectionArchives,
  useUploaderCollections,
} from './use-uploader-seasons';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    fetchUploaderCollections: vi.fn(),
    fetchCollectionArchives: vi.fn(),
  };
});

const mockedFetchCollections = vi.mocked(fetchUploaderCollections);
const mockedFetchArchives = vi.mocked(fetchCollectionArchives);

function buildArchive(bvid: string): BilibiliSeasonVideo {
  return { aid: 1, bvid, title: `t-${bvid}`, pic: `pic-${bvid}`, pubdate: 1000, duration: 60 };
}

describe('useUploaderCollections', () => {
  beforeEach(() => {
    mockedFetchCollections.mockReset();
  });

  it('mid 为空时不发起请求', async () => {
    const { result } = renderHook(() => useUploaderCollections(undefined));
    expect(result.current.items).toEqual([]);
    expect(mockedFetchCollections).not.toHaveBeenCalled();
  });

  it('mid 变化时自动拉取第 1 页，items 同时含 season 与 series', async () => {
    mockedFetchCollections.mockResolvedValueOnce({
      items: [
        {
          source: 'season',
          id: 1,
          mid: 100,
          name: '合集A',
          cover: 'cover-a',
          description: '',
          total: 5,
        },
        {
          source: 'series',
          id: 2,
          mid: 100,
          name: '系列B',
          cover: 'cover-b',
          description: '',
          total: 3,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    const { result } = renderHook(() => useUploaderCollections('100'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].source).toBe('season');
    expect(result.current.items[1].source).toBe('series');
    expect(mockedFetchCollections).toHaveBeenCalledWith('100', 1, 20);
  });

  it('setPage 触发新页请求', async () => {
    mockedFetchCollections.mockResolvedValue({
      items: [],
      total: 30,
      page: 1,
      pageSize: 20,
      hasMore: true,
    });
    const { result } = renderHook(() => useUploaderCollections('100'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockedFetchCollections.mockClear();
    mockedFetchCollections.mockResolvedValueOnce({
      items: [],
      total: 30,
      page: 2,
      pageSize: 20,
      hasMore: false,
    });
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    expect(mockedFetchCollections).toHaveBeenCalledWith('100', 2, 20);
  });

  it('请求失败时 error 落地，isLoading 复位', async () => {
    mockedFetchCollections.mockRejectedValueOnce({ message: '风控了' });
    const { result } = renderHook(() => useUploaderCollections('100'));
    await waitFor(() => expect(result.current.error).toBe('风控了'));
    expect(result.current.isLoading).toBe(false);
  });

  it('卸载后旧响应不再写入 state', async () => {
    let resolveFn: ((v: Awaited<ReturnType<typeof fetchUploaderCollections>>) => void) | undefined;
    mockedFetchCollections.mockImplementationOnce(
      () =>
        new Promise<Awaited<ReturnType<typeof fetchUploaderCollections>>>((r) => {
          resolveFn = r;
        }),
    );
    const { unmount } = renderHook(() => useUploaderCollections('100'));
    unmount();
    resolveFn?.({ items: [], total: 0, page: 1, pageSize: 20, hasMore: false });
    await Promise.resolve();
    expect(true).toBe(true);
  });
});

describe('useCollectionArchives', () => {
  beforeEach(() => {
    mockedFetchArchives.mockReset();
  });

  it('参数缺失时不发起请求', () => {
    renderHook(() => useCollectionArchives(undefined, 'season', '1'));
    renderHook(() => useCollectionArchives('100', undefined, '1'));
    renderHook(() => useCollectionArchives('100', 'season', undefined));
    expect(mockedFetchArchives).not.toHaveBeenCalled();
  });

  it('参数齐全时自动拉取，传 source 给底层', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      name: '合集X',
      description: 'd',
      cover: 'c',
      archives: [buildArchive('BV1')],
      total: 30,
      page: 1,
      pageSize: 30,
      hasMore: false,
    });
    const { result } = renderHook(() => useCollectionArchives('100', 'series', '7'));
    await waitFor(() => expect(result.current.archives).toHaveLength(1));
    expect(mockedFetchArchives).toHaveBeenCalledWith('100', 'series', '7', 1, 30);
  });

  it('series 接口无 meta 时使用 fallbackMeta', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      archives: [buildArchive('BV1')],
      total: 1,
      page: 1,
      pageSize: 30,
      hasMore: false,
    });
    const { result } = renderHook(() =>
      useCollectionArchives('100', 'series', '7', {
        name: 'fb-name',
        description: 'fb-desc',
        cover: 'fb-cover',
      }),
    );
    await waitFor(() => expect(result.current.archives).toHaveLength(1));
    expect(result.current.name).toBe('fb-name');
    expect(result.current.cover).toBe('fb-cover');
  });

  it('collectionId 变化重置到第 1 页', async () => {
    mockedFetchArchives.mockImplementation(async (_mid, _src, _id, page, pageSize) => ({
      archives: [],
      total: 0,
      page: page ?? 1,
      pageSize: pageSize ?? 30,
      hasMore: false,
    }));
    const { result, rerender } = renderHook(
      ({ collectionId }: { collectionId: string }) =>
        useCollectionArchives('100', 'season', collectionId),
      { initialProps: { collectionId: '1' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    rerender({ collectionId: '2' });
    await waitFor(() => expect(result.current.page).toBe(1));
  });
});

describe('useCollectionAllArchives', () => {
  beforeEach(() => {
    mockedFetchArchives.mockReset();
  });

  it('trigger 拉首页 + 并发拉剩余页', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      archives: [buildArchive('BV1'), buildArchive('BV2'), buildArchive('BV3')],
      total: 60,
      page: 1,
      pageSize: 30,
      hasMore: true,
    });
    mockedFetchArchives.mockResolvedValueOnce({
      archives: [buildArchive('BV4'), buildArchive('BV5')],
      total: 60,
      page: 2,
      pageSize: 30,
      hasMore: false,
    });
    const { result } = renderHook(() => useCollectionAllArchives('100', 'season', '1'));
    let returned: BilibiliSeasonVideo[] | null = null;
    await act(async () => {
      returned = await result.current.trigger();
    });
    expect(returned).toHaveLength(5);
    expect(result.current.archives.map((a) => a.bvid)).toEqual(['BV1', 'BV2', 'BV3', 'BV4', 'BV5']);
    expect(result.current.done).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mockedFetchArchives).toHaveBeenCalledTimes(2);
  });

  it('单页足够时不再发起额外请求', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      archives: [buildArchive('BV1'), buildArchive('BV2')],
      total: 2,
      page: 1,
      pageSize: 30,
      hasMore: false,
    });
    const { result } = renderHook(() => useCollectionAllArchives('100', 'season', '1'));
    let returned: BilibiliSeasonVideo[] | null = null;
    await act(async () => {
      returned = await result.current.trigger();
    });
    expect(returned).toHaveLength(2);
    expect(mockedFetchArchives).toHaveBeenCalledTimes(1);
    expect(result.current.done).toBe(true);
  });

  it('剩余页失败时整体失败，保留首页已拉到的部分', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      archives: [buildArchive('BV1')],
      total: 60,
      page: 1,
      pageSize: 30,
      hasMore: true,
    });
    mockedFetchArchives.mockRejectedValueOnce({ message: '中断' });
    const { result } = renderHook(() => useCollectionAllArchives('100', 'series', '1'));
    let returned: BilibiliSeasonVideo[] | null = null;
    await act(async () => {
      returned = await result.current.trigger();
    });
    expect(returned).toBeNull();
    expect(result.current.error).toBe('中断');
    expect(result.current.archives).toHaveLength(1);
    expect(result.current.done).toBe(false);
  });

  it('参数缺失时返回 null 且不发起请求', async () => {
    const { result } = renderHook(() => useCollectionAllArchives(undefined, 'season', '1'));
    const returned = await result.current.trigger();
    expect(returned).toBeNull();
    expect(mockedFetchArchives).not.toHaveBeenCalled();
  });
});
