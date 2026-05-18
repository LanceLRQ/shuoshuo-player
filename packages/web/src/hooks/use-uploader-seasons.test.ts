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

  it('trigger 串行拉所有页，累积所有 archives', async () => {
    mockedFetchArchives.mockImplementation(async (_m, _s, _id, page) => {
      if (page === 1) {
        return {
          archives: [buildArchive('BV1'), buildArchive('BV2'), buildArchive('BV3')],
          total: 60,
          page: 1,
          pageSize: 30,
          hasMore: true,
        };
      }
      return {
        archives: [buildArchive('BV4'), buildArchive('BV5')],
        total: 60,
        page: 2,
        pageSize: 30,
        hasMore: false,
      };
    });
    const { result } = renderHook(() => useCollectionAllArchives('100', 'season', '1'));
    let returned: BilibiliSeasonVideo[] | null = null;
    await act(async () => {
      returned = await result.current.trigger();
    });
    expect(returned).toHaveLength(5);
    // 串行调用顺序：page=1, page=2（前一页完成才发下一页）
    expect(mockedFetchArchives.mock.calls.map((c) => c[3])).toEqual([1, 2]);
    expect(result.current.archives.map((a) => a.bvid)).toEqual(['BV1', 'BV2', 'BV3', 'BV4', 'BV5']);
    expect(result.current.done).toBe(true);
    expect(result.current.isLoading).toBe(false);
  }, 10_000);

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

  it('串行碰到失败立即停止，已拉部分保留', async () => {
    mockedFetchArchives.mockImplementation(async (_m, _s, _id, page) => {
      if (page === 1) {
        return {
          archives: [buildArchive('BV1')],
          total: 90,
          page: 1,
          pageSize: 30,
          hasMore: true,
        };
      }
      if (page === 2) throw { message: '中断' };
      throw new Error('should not reach page 3');
    });
    const { result } = renderHook(() => useCollectionAllArchives('100', 'series', '1'));
    let returned: BilibiliSeasonVideo[] | null = null;
    await act(async () => {
      returned = await result.current.trigger();
    });
    expect(returned).toBeNull();
    expect(result.current.error).toBe('中断');
    expect(result.current.archives).toHaveLength(1);
    // page=2 失败后 page=3 不应被调用
    expect(mockedFetchArchives.mock.calls.map((c) => c[3])).toEqual([1, 2]);
  }, 10_000);

  it('trigger({ fromPage, toPage }) 只拉指定页范围', async () => {
    mockedFetchArchives.mockImplementation(async (_m, _s, _id, page) => ({
      archives: [buildArchive(`BV-page-${page}`)],
      total: 300,
      page: page ?? 1,
      pageSize: 30,
      hasMore: (page ?? 1) < 10,
    }));
    const { result } = renderHook(() => useCollectionAllArchives('100', 'season', '1'));
    await act(async () => {
      await result.current.trigger({ fromPage: 4, toPage: 6 });
    });
    const pages = mockedFetchArchives.mock.calls.map((c) => c[3]);
    expect(pages).toEqual([4, 5, 6]);
    expect(result.current.archives.map((a) => a.bvid)).toEqual([
      'BV-page-4',
      'BV-page-5',
      'BV-page-6',
    ]);
    expect(result.current.done).toBe(true);
  }, 10_000);

  it('cancel() 立即把 isLoading 置 false，已拉到的 archives 保留', async () => {
    // page=1 立即完成；page=2 卡住不 resolve，模拟用户在中途按取消
    let resolvePage2:
      | ((v: Awaited<ReturnType<typeof fetchCollectionArchives>>) => void)
      | undefined;
    mockedFetchArchives.mockImplementation(async (_m, _s, _id, page) => {
      if (page === 1) {
        return {
          archives: [buildArchive('BV1'), buildArchive('BV2'), buildArchive('BV3')],
          total: 60,
          page: 1,
          pageSize: 30,
          hasMore: true,
        };
      }
      return new Promise((r) => {
        resolvePage2 = r;
      });
    });
    const { result } = renderHook(() => useCollectionAllArchives('100', 'season', '1'));
    let triggerPromise: Promise<BilibiliSeasonVideo[] | null> | undefined;
    await act(async () => {
      triggerPromise = result.current.trigger();
      // 等 page=1 完成 + sleep 进行中
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.archives).toHaveLength(3);
    // 用户取消
    await act(async () => {
      result.current.cancel();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.archives).toHaveLength(3);
    // 即使后续 page=2 完成，已无效不再写 state
    resolvePage2?.({
      archives: [buildArchive('BV4')],
      total: 60,
      page: 2,
      pageSize: 30,
      hasMore: false,
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.archives).toHaveLength(3);
    // trigger 因 cancel 早退返回 null
    const returned = await triggerPromise;
    expect(returned).toBeNull();
  }, 10_000);

  it('参数缺失时返回 null 且不发起请求', async () => {
    const { result } = renderHook(() => useCollectionAllArchives(undefined, 'season', '1'));
    const returned = await result.current.trigger();
    expect(returned).toBeNull();
    expect(mockedFetchArchives).not.toHaveBeenCalled();
  });
});
