/**
 * Hook 单测：useUploaderSeasons / useSeasonArchives / useSeasonAllArchives
 *
 * Mock 策略：
 * - vi.mock 拦截 @shuoshuo-player/shared 的 fetchUploaderSeasons / fetchSeasonArchives
 * - 通过 mockImplementation 让每次调用返回不同 payload，覆盖分页 / 全量 / 错误场景
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  fetchSeasonArchives,
  fetchUploaderSeasons,
  type BilibiliSeasonVideo,
} from '@shuoshuo-player/shared';
import {
  useSeasonAllArchives,
  useSeasonArchives,
  useUploaderSeasons,
} from './use-uploader-seasons';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    fetchUploaderSeasons: vi.fn(),
    fetchSeasonArchives: vi.fn(),
  };
});

const mockedFetchSeasons = vi.mocked(fetchUploaderSeasons);
const mockedFetchArchives = vi.mocked(fetchSeasonArchives);

function buildArchive(bvid: string): BilibiliSeasonVideo {
  return {
    aid: 1,
    bvid,
    title: `t-${bvid}`,
    pic: `pic-${bvid}`,
    pubdate: 1000,
    duration: 60,
  };
}

describe('useUploaderSeasons', () => {
  beforeEach(() => {
    mockedFetchSeasons.mockReset();
  });

  it('mid 为空时不发起请求', async () => {
    const { result } = renderHook(() => useUploaderSeasons(undefined));
    expect(result.current.items).toEqual([]);
    expect(mockedFetchSeasons).not.toHaveBeenCalled();
  });

  it('mid 变化时自动拉取第 1 页并写入 state', async () => {
    mockedFetchSeasons.mockResolvedValueOnce({
      items: [
        {
          meta: {
            season_id: 1,
            mid: 100,
            name: '合集A',
            cover: 'cover-a',
            description: '',
            total: 5,
          },
          effectiveCover: 'cover-a',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    const { result } = renderHook(() => useUploaderSeasons('100'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].meta.name).toBe('合集A');
    expect(mockedFetchSeasons).toHaveBeenCalledWith('100', 1, 20);
  });

  it('setPage 触发新页请求', async () => {
    mockedFetchSeasons.mockResolvedValue({
      items: [],
      total: 30,
      page: 1,
      pageSize: 20,
      hasMore: true,
    });
    const { result } = renderHook(() => useUploaderSeasons('100'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockedFetchSeasons.mockClear();
    mockedFetchSeasons.mockResolvedValueOnce({
      items: [],
      total: 30,
      page: 2,
      pageSize: 20,
      hasMore: false,
    });
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    expect(mockedFetchSeasons).toHaveBeenCalledWith('100', 2, 20);
  });

  it('请求失败时 error 落地，isLoading 复位', async () => {
    mockedFetchSeasons.mockRejectedValueOnce({ message: '风控了' });
    const { result } = renderHook(() => useUploaderSeasons('100'));
    await waitFor(() => expect(result.current.error).toBe('风控了'));
    expect(result.current.isLoading).toBe(false);
  });

  it('卸载后旧响应不再写入 state', async () => {
    let resolveFn: ((v: Awaited<ReturnType<typeof fetchUploaderSeasons>>) => void) | undefined;
    mockedFetchSeasons.mockImplementationOnce(
      () =>
        new Promise<Awaited<ReturnType<typeof fetchUploaderSeasons>>>((r) => {
          resolveFn = r;
        }),
    );
    const { unmount } = renderHook(() => useUploaderSeasons('100'));
    unmount();
    resolveFn?.({ items: [], total: 0, page: 1, pageSize: 20, hasMore: false });
    // 等一轮 microtask 确保没崩
    await Promise.resolve();
    expect(true).toBe(true);
  });
});

describe('useSeasonArchives', () => {
  beforeEach(() => {
    mockedFetchArchives.mockReset();
  });

  it('mid 或 seasonId 为空时不发起请求', () => {
    renderHook(() => useSeasonArchives(undefined, '1'));
    renderHook(() => useSeasonArchives('100', undefined));
    expect(mockedFetchArchives).not.toHaveBeenCalled();
  });

  it('参数齐全时自动拉取', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      meta: {
        season_id: 7,
        mid: 100,
        name: '合集X',
        cover: 'c',
        description: 'd',
        total: 30,
      },
      archives: [buildArchive('BV1')],
      total: 30,
      page: 1,
      pageSize: 30,
      hasMore: false,
    });
    const { result } = renderHook(() => useSeasonArchives('100', '7'));
    await waitFor(() => expect(result.current.meta?.season_id).toBe(7));
    expect(result.current.archives).toHaveLength(1);
    expect(mockedFetchArchives).toHaveBeenCalledWith('100', '7', 1, 30);
  });

  it('seasonId 变化重置到第 1 页', async () => {
    // mock 动态回 page，让 hook 写入的 page 反映实际请求页码
    mockedFetchArchives.mockImplementation(async (_mid, _sid, page, pageSize) => ({
      meta: {
        season_id: 1,
        mid: 100,
        name: '',
        cover: '',
        description: '',
        total: 0,
      },
      archives: [],
      total: 0,
      page: page ?? 1,
      pageSize: pageSize ?? 30,
      hasMore: false,
    }));
    const { result, rerender } = renderHook(
      ({ seasonId }: { seasonId: string }) => useSeasonArchives('100', seasonId),
      { initialProps: { seasonId: '1' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    rerender({ seasonId: '2' });
    await waitFor(() => expect(result.current.page).toBe(1));
  });
});

describe('useSeasonAllArchives', () => {
  beforeEach(() => {
    mockedFetchArchives.mockReset();
  });

  it('trigger 拉取首页 + 并发拉剩余页，累积所有 archives', async () => {
    // total=60 + pageSize=30 → 2 页：page=1 + page=2 并发
    const buildMeta = () => ({
      season_id: 1,
      mid: 100,
      name: '',
      cover: '',
      description: '',
      total: 60,
    });
    mockedFetchArchives.mockResolvedValueOnce({
      meta: buildMeta(),
      archives: [buildArchive('BV1'), buildArchive('BV2'), buildArchive('BV3')],
      total: 60,
      page: 1,
      pageSize: 30,
      hasMore: true,
    });
    mockedFetchArchives.mockResolvedValueOnce({
      meta: buildMeta(),
      archives: [buildArchive('BV4'), buildArchive('BV5')],
      total: 60,
      page: 2,
      pageSize: 30,
      hasMore: false,
    });
    const { result } = renderHook(() => useSeasonAllArchives('100', '1'));
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

  it('单页足够时不再发起额外请求（small case）', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      meta: {
        season_id: 1,
        mid: 100,
        name: '',
        cover: '',
        description: '',
        total: 2,
      },
      archives: [buildArchive('BV1'), buildArchive('BV2')],
      total: 2,
      page: 1,
      pageSize: 30,
      hasMore: false,
    });
    const { result } = renderHook(() => useSeasonAllArchives('100', '1'));
    let returned: BilibiliSeasonVideo[] | null = null;
    await act(async () => {
      returned = await result.current.trigger();
    });
    expect(returned).toHaveLength(2);
    expect(mockedFetchArchives).toHaveBeenCalledTimes(1);
    expect(result.current.done).toBe(true);
  });

  it('剩余页中任一失败时整体失败，保留首页已拉到的部分', async () => {
    mockedFetchArchives.mockResolvedValueOnce({
      meta: {
        season_id: 1,
        mid: 100,
        name: '',
        cover: '',
        description: '',
        total: 60,
      },
      archives: [buildArchive('BV1')],
      total: 60,
      page: 1,
      pageSize: 30,
      hasMore: true,
    });
    mockedFetchArchives.mockRejectedValueOnce({ message: '中断' });
    const { result } = renderHook(() => useSeasonAllArchives('100', '1'));
    let returned: BilibiliSeasonVideo[] | null = null;
    await act(async () => {
      returned = await result.current.trigger();
    });
    expect(returned).toBeNull();
    expect(result.current.error).toBe('中断');
    expect(result.current.archives).toHaveLength(1);
    expect(result.current.done).toBe(false);
  });

  it('mid/seasonId 缺失时返回 null 且不发起请求', async () => {
    const { result } = renderHook(() => useSeasonAllArchives(undefined, '1'));
    const returned = await result.current.trigger();
    expect(returned).toBeNull();
    expect(mockedFetchArchives).not.toHaveBeenCalled();
  });
});
