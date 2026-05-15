import { bilibiliPure } from '../client';
import { fetchUploaderSeasons, fetchSeasonArchives } from './collection';

describe('S1: fetchUploaderSeasons 适配器', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('丢弃 series_list，只取 seasons_list', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          items_lists: {
            seasons_list: [
              {
                meta: {
                  season_id: 1,
                  mid: 100,
                  name: '合集A',
                  cover: 'http://x/a.jpg',
                  description: '',
                  total: 5,
                },
                archives: [],
              },
            ],
            series_list: [{ meta: { name: '系列B' } }],
            page: { num: 1, size: 20, total: 1 },
          },
        },
      },
    });
    const result = await fetchUploaderSeasons('100');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].meta.name).toBe('合集A');
  });

  it('封面 fallback：meta.cover 为空时取 archives[0].pic', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          items_lists: {
            seasons_list: [
              {
                meta: {
                  season_id: 1,
                  mid: 100,
                  name: '无封面合集',
                  cover: '',
                  description: '',
                  total: 3,
                },
                archives: [
                  {
                    aid: 1,
                    bvid: 'BV1',
                    title: '最新视频',
                    pic: 'http://x/latest.jpg',
                    pubdate: 1000,
                    duration: 60,
                  },
                ],
              },
            ],
            page: { num: 1, size: 20, total: 1 },
          },
        },
      },
    });
    const result = await fetchUploaderSeasons('100');
    expect(result.items[0].effectiveCover).toBe('http://x/latest.jpg');
  });

  it('封面 fallback：meta.cover 和 archives 都为空时返回空串', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          items_lists: {
            seasons_list: [
              {
                meta: {
                  season_id: 1,
                  mid: 100,
                  name: '裸合集',
                  cover: '',
                  description: '',
                  total: 0,
                },
              },
            ],
            page: { num: 1, size: 20, total: 1 },
          },
        },
      },
    });
    const result = await fetchUploaderSeasons('100');
    expect(result.items[0].effectiveCover).toBe('');
  });

  it('过滤 is_opened === 0 的私密合集（客户端兜底）', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          items_lists: {
            seasons_list: [
              {
                meta: {
                  season_id: 1,
                  mid: 100,
                  name: '公开合集',
                  cover: '',
                  description: '',
                  total: 3,
                  is_opened: 1,
                },
              },
              {
                meta: {
                  season_id: 2,
                  mid: 100,
                  name: '私密合集',
                  cover: '',
                  description: '',
                  total: 5,
                  is_opened: 0,
                },
              },
              {
                meta: {
                  season_id: 3,
                  mid: 100,
                  name: '无标记合集',
                  cover: '',
                  description: '',
                  total: 1,
                },
              },
            ],
            page: { num: 1, size: 20, total: 3 },
          },
        },
      },
    });
    const result = await fetchUploaderSeasons('100');
    expect(result.items.map((i) => i.meta.name)).toEqual(['公开合集', '无标记合集']);
  });

  it('seasons_list 为空时返回空数组且 total=0', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          items_lists: {
            page: { num: 1, size: 20, total: 0 },
          },
        },
      },
    });
    const result = await fetchUploaderSeasons('100');
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('hasMore 计算：page * pageSize < total 才为 true', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          items_lists: {
            seasons_list: [],
            page: { num: 1, size: 20, total: 50 },
          },
        },
      },
    });
    const result = await fetchUploaderSeasons('100', 1, 20);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(50);
  });

  it('请求参数透传 mid/page/pageSize', async () => {
    const spy = vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          items_lists: {
            seasons_list: [],
            page: { num: 2, size: 10, total: 0 },
          },
        },
      },
    });
    await fetchUploaderSeasons('12345', 2, 10);
    expect(spy.mock.calls[0][0].params).toMatchObject({
      mid: '12345',
      page_num: 2,
      page_size: 10,
    });
    expect((spy.mock.calls[0][0] as { __useWbi?: boolean }).__useWbi).toBe(true);
  });
});

describe('S2: fetchSeasonArchives 适配器', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('透传 meta 与 archives，并计算 hasMore', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          meta: {
            season_id: 42,
            mid: 100,
            name: '合集X',
            cover: 'http://x/c.jpg',
            description: 'desc',
            total: 100,
          },
          archives: [
            {
              aid: 1,
              bvid: 'BV1',
              title: 'v1',
              pic: 'p1',
              pubdate: 1000,
              duration: 60,
              stat: { view: 999 },
            },
          ],
          page: { num: 1, size: 30, total: 100 },
        },
      },
    });
    const result = await fetchSeasonArchives('100', '42', 1, 30);
    expect(result.meta.name).toBe('合集X');
    expect(result.archives).toHaveLength(1);
    expect(result.archives[0].bvid).toBe('BV1');
    expect(result.total).toBe(100);
    expect(result.hasMore).toBe(true);
  });

  it('archives 缺失时 fallback 空数组', async () => {
    vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          meta: {
            season_id: 1,
            mid: 100,
            name: '空合集',
            cover: '',
            description: '',
            total: 0,
          },
          page: { num: 1, size: 30, total: 0 },
        },
      },
    });
    const result = await fetchSeasonArchives('100', '1');
    expect(result.archives).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it('sort_reverse 参数：true 传 1，false 传 0', async () => {
    const spy = vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          meta: {
            season_id: 1,
            mid: 100,
            name: '',
            cover: '',
            description: '',
            total: 0,
          },
          archives: [],
          page: { num: 1, size: 30, total: 0 },
        },
      },
    });
    await fetchSeasonArchives('100', '1', 1, 30, true);
    expect(spy.mock.calls[0][0].params.sort_reverse).toBe(1);
    spy.mockClear();
    await fetchSeasonArchives('100', '1', 1, 30, false);
    expect(spy.mock.calls[0][0].params.sort_reverse).toBe(0);
  });

  it('请求参数透传 mid/season_id/page/pageSize 且带 WBI 标记', async () => {
    const spy = vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
      data: {
        code: 0,
        data: {
          meta: {
            season_id: 7,
            mid: 500,
            name: '',
            cover: '',
            description: '',
            total: 0,
          },
          archives: [],
          page: { num: 1, size: 30, total: 0 },
        },
      },
    });
    await fetchSeasonArchives('500', '7', 3, 50);
    expect(spy.mock.calls[0][0].params).toMatchObject({
      mid: '500',
      season_id: '7',
      page_num: 3,
      page_size: 50,
    });
    expect((spy.mock.calls[0][0] as { __useWbi?: boolean }).__useWbi).toBe(true);
  });
});
