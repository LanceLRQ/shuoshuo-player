import { bilibiliPure } from '../client';
import { fetchCollectionArchives, fetchUploaderCollections } from './collection';

function mockOnce(data: unknown) {
  return vi.spyOn(bilibiliPure, 'request').mockResolvedValueOnce({
    data: { code: 0, data },
  } as never);
}
function mockAlways(data: unknown) {
  return vi.spyOn(bilibiliPure, 'request').mockResolvedValue({
    data: { code: 0, data },
  } as never);
}

describe('S1: fetchUploaderCollections 合并 seasons + series', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('seasons_list 和 series_list 都被映射并合并（seasons 在前）', async () => {
    mockOnce({
      items_lists: {
        seasons_list: [
          {
            meta: {
              season_id: 1,
              mid: 100,
              name: '合集A',
              cover: 'http://x/a.jpg',
              description: 'descA',
              total: 5,
            },
          },
        ],
        series_list: [
          {
            meta: {
              series_id: 2,
              mid: 100,
              name: '系列B',
              cover: 'http://x/b.jpg',
              description: 'descB',
              total: 3,
            },
          },
        ],
        page: { num: 1, size: 20, total: 2 },
      },
    });
    const result = await fetchUploaderCollections('100');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ source: 'season', id: 1, name: '合集A' });
    expect(result.items[1]).toMatchObject({ source: 'series', id: 2, name: '系列B' });
    expect(result.total).toBe(2);
  });

  it('seasons_list 私密项（is_opened=0）被客户端兜底过滤', async () => {
    mockOnce({
      items_lists: {
        seasons_list: [
          {
            meta: {
              season_id: 1,
              mid: 100,
              name: '公开',
              cover: '',
              description: '',
              total: 1,
              is_opened: 1,
            },
          },
          {
            meta: {
              season_id: 2,
              mid: 100,
              name: '私密',
              cover: '',
              description: '',
              total: 1,
              is_opened: 0,
            },
          },
        ],
        series_list: [],
        page: { num: 1, size: 20, total: 2 },
      },
    });
    const result = await fetchUploaderCollections('100');
    expect(result.items.map((i) => i.name)).toEqual(['公开']);
  });

  it('封面 fallback：meta.cover 空时取 archives[0].pic（season 和 series 都适用）', async () => {
    mockOnce({
      items_lists: {
        seasons_list: [
          {
            meta: { season_id: 1, mid: 100, name: 'season', cover: '', description: '', total: 1 },
            archives: [
              { aid: 1, bvid: 'BV1', title: 't', pic: 'season-pic', pubdate: 0, duration: 0 },
            ],
          },
        ],
        series_list: [
          {
            meta: { series_id: 2, mid: 100, name: 'series', cover: '', description: '', total: 1 },
            archives: [
              { aid: 2, bvid: 'BV2', title: 't', pic: 'series-pic', pubdate: 0, duration: 0 },
            ],
          },
        ],
        page: { num: 1, size: 20, total: 2 },
      },
    });
    const result = await fetchUploaderCollections('100');
    expect(result.items[0].cover).toBe('season-pic');
    expect(result.items[1].cover).toBe('series-pic');
  });

  it('seasons_list / series_list 都缺失时返回空数组', async () => {
    mockOnce({
      items_lists: { page: { num: 1, size: 20, total: 0 } },
    });
    const result = await fetchUploaderCollections('100');
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('hasMore 计算与 WBI 标记透传', async () => {
    const spy = mockAlways({
      items_lists: {
        seasons_list: [],
        series_list: [],
        page: { num: 1, size: 20, total: 60 },
      },
    });
    const result = await fetchUploaderCollections('12345', 2, 10);
    expect(result.hasMore).toBe(true);
    expect(spy.mock.calls[0][0].params).toMatchObject({
      mid: '12345',
      page_num: 2,
      page_size: 10,
    });
    expect((spy.mock.calls[0][0] as { __useWbi?: boolean }).__useWbi).toBe(true);
  });
});

describe('S2: fetchCollectionArchives 按 source 路由', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('source=season → 调用 seasons_archives_list（含 meta），透传 page_num/page_size', async () => {
    const spy = mockOnce({
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
    });
    const result = await fetchCollectionArchives('100', 'season', '42', 1, 30);
    expect(spy.mock.calls[0][0].url).toContain('seasons_archives_list');
    expect(spy.mock.calls[0][0].params).toMatchObject({
      mid: '100',
      season_id: '42',
      page_num: 1,
      page_size: 30,
    });
    expect(result.name).toBe('合集X');
    expect(result.cover).toBe('http://x/c.jpg');
    expect(result.archives).toHaveLength(1);
    expect(result.total).toBe(100);
    expect(result.hasMore).toBe(true);
  });

  it('source=series → 调用 series/archives，参数命名为 pn/ps，meta 留空待外部兜底', async () => {
    const spy = mockOnce({
      aids: [1, 2],
      archives: [
        { aid: 1, bvid: 'BV1', title: 's1', pic: 'p1', pubdate: 1000, duration: 60 },
        { aid: 2, bvid: 'BV2', title: 's2', pic: 'p2', pubdate: 2000, duration: 90 },
      ],
      page: { num: 1, size: 30, total: 2 },
    });
    const result = await fetchCollectionArchives('100', 'series', '99', 1, 30);
    expect(spy.mock.calls[0][0].url).toContain('series/archives');
    expect(spy.mock.calls[0][0].params).toMatchObject({
      mid: '100',
      series_id: '99',
      pn: 1,
      ps: 30,
    });
    expect(result.archives).toHaveLength(2);
    expect(result.name).toBeUndefined();
    expect(result.cover).toBeUndefined();
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('archives 缺失时 fallback 空数组（season）', async () => {
    mockOnce({
      meta: { season_id: 1, mid: 100, name: '空', cover: '', description: '', total: 0 },
      page: { num: 1, size: 30, total: 0 },
    });
    const result = await fetchCollectionArchives('100', 'season', '1');
    expect(result.archives).toEqual([]);
    expect(result.hasMore).toBe(false);
  });
});
