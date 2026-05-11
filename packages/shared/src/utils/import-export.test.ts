import { describe, it, expect } from 'vitest';
import { parseImportData, buildMerged, CURRENT_EXPORT_VERSION } from './import-export';
import { FavListType } from '../types';

const v2Item = (id: string, name = `name-${id}`, bvids: string[] = []) => ({
  id,
  name,
  type: FavListType.CUSTOM,
  bv_ids: bvids,
  create_time: 1700000000,
  update_time: 1700000000,
});

describe('parseImportData', () => {
  it('返回 null：非 plain object', () => {
    expect(parseImportData(null)).toBeNull();
    expect(parseImportData(undefined)).toBeNull();
    expect(parseImportData(42)).toBeNull();
    expect(parseImportData('foo')).toBeNull();
    expect(parseImportData([])).toBeNull();
  });

  it('返回 null：空 object 或仅含未知 key', () => {
    expect(parseImportData({})).toBeNull();
    expect(parseImportData({ randomKey: 1, foo: 'bar' })).toBeNull();
  });

  it('返回 null：fav_list 不是 object（类型错位）', () => {
    expect(parseImportData({ fav_list: 'abc' })).toBeNull();
    expect(parseImportData({ fav_list: [1, 2, 3] })).toBeNull();
  });

  it('返回 null：version 出现但既不是 "2" 也不是 2', () => {
    expect(parseImportData({ version: '3', fav_list: { list: [] } })).toBeNull();
    expect(parseImportData({ version: 'foo', fav_list: { list: [] } })).toBeNull();
  });

  it('v2 格式：仅含 fav_list（无 lyrics）解析正确', () => {
    const out = parseImportData({
      version: CURRENT_EXPORT_VERSION,
      fav_list: { list: [v2Item('A'), v2Item('B')] },
    });
    expect(out).not.toBeNull();
    expect(out!.version).toBe('2');
    expect(out!.favList).toHaveLength(2);
    expect(out!.lyricCount).toBe(0);
    expect(out!.payload.lyrics).toEqual({ lyricMaps: {} });
  });

  it('version 字段为数字 2 也识别为 v2', () => {
    const out = parseImportData({ version: 2, fav_list: { list: [v2Item('A')] } });
    expect(out!.version).toBe('2');
  });

  it('缺 version 字段视为 v1', () => {
    const out = parseImportData({ fav_list: { list: [] } });
    expect(out!.version).toBe('1');
  });

  it('v1 → v2 标准化：mid 数字转字符串', () => {
    const out = parseImportData({
      fav_list: {
        list: [
          {
            id: 'X1',
            name: 'foo',
            type: FavListType.UPLOADER,
            mid: 2025922,
            bv_ids: [],
            create_time: 0,
            update_time: 0,
          },
        ],
      },
    });
    expect(out!.favList[0].mid).toBe('2025922');
    expect(typeof out!.favList[0].mid).toBe('string');
  });

  it('v1 → v2 标准化：13 位毫秒时间转秒', () => {
    const out = parseImportData({
      fav_list: {
        list: [
          {
            id: 'X1',
            name: 'foo',
            type: FavListType.CUSTOM,
            mid: '',
            bv_ids: [],
            create_time: 1778230431066,
            update_time: 1778230484030,
          },
        ],
      },
    });
    expect(out!.favList[0].create_time).toBe(1778230431);
    expect(out!.favList[0].update_time).toBe(1778230484);
  });

  it('v1 → v2 标准化：mid 空字符串归一化为 undefined', () => {
    const out = parseImportData({
      fav_list: {
        list: [
          {
            id: 'X1',
            name: 'foo',
            type: FavListType.CUSTOM,
            mid: '',
            bv_ids: [],
            create_time: 0,
            update_time: 0,
          },
        ],
      },
    });
    expect(out!.favList[0].mid).toBeUndefined();
  });

  it('lyrics.lyricMaps 计数正确', () => {
    const out = parseImportData({
      version: '2',
      fav_list: { list: [] },
      lyrics: {
        lyricMaps: {
          BV1: { id: 'a', bvid: 'BV1' },
          BV2: { id: 'b', bvid: 'BV2' },
        },
      },
    });
    expect(out!.lyricCount).toBe(2);
  });

  it('提取 bili_videos.entities 与 ids，并计入 videoCount', () => {
    const out = parseImportData({
      version: '2',
      fav_list: { list: [] },
      bili_videos: {
        entities: {
          BVa: { bvid: 'BVa', title: 'a' },
          BVb: { bvid: 'BVb', title: 'b' },
        },
        ids: ['BVa', 'BVb'],
      },
    });
    expect(out!.videoCount).toBe(2);
    expect(Object.keys(out!.payload.bili_videos.entities ?? {}).sort()).toEqual(['BVa', 'BVb']);
    expect(out!.payload.bili_videos.ids).toEqual(['BVa', 'BVb']);
  });

  it('bili_videos.ids 缺失时 fallback 为 entities 的 keys', () => {
    const out = parseImportData({
      version: '2',
      fav_list: { list: [] },
      bili_videos: { entities: { BVx: { bvid: 'BVx' } } },
    });
    expect(out!.payload.bili_videos.ids).toEqual(['BVx']);
  });

  it('丢弃脏数据：id 为空 / type 非 0/1/2 的歌单项被过滤', () => {
    const out = parseImportData({
      version: '2',
      fav_list: {
        list: [
          v2Item('A'),
          { ...v2Item('B'), id: '' }, // id 为空
          { ...v2Item('C'), type: 99 }, // 非法 type
        ],
      },
    });
    expect(out!.favList.map((it) => it.id)).toEqual(['A']);
  });
});

describe('buildMerged', () => {
  const importedPayload = {
    fav_list: { list: [v2Item('A', 'imported-A'), v2Item('B', 'imported-B')] },
    lyrics: { lyricMaps: { BV1: { bvid: 'BV1' }, BV2: { bvid: 'BV2' } } as never },
    bili_videos: { entities: {}, ids: [] },
  };

  it('skip：仅添加 current 不存在的项；A 保持现有内容', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'skip',
    );
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'C', 'B']);
    // A 保持现有内容（current-A），不被 imported 覆盖
    expect(out.fav_list.list?.find((it) => it.id === 'A')?.name).toBe('current-A');
  });

  it('replace：type=0 的同 id 被覆盖，新 id 追加，未出现的 current 项保留', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'replace',
    );
    const ids = out.fav_list.list?.map((it) => it.id) ?? [];
    expect(new Set(ids)).toEqual(new Set(['A', 'B', 'C']));
    // A 被替换为导入版本（type=0）
    expect(out.fav_list.list?.find((it) => it.id === 'A')?.name).toBe('imported-A');
    // C 在导入文件中没有，保留
    expect(out.fav_list.list?.find((it) => it.id === 'C')?.name).toBe('current-C');
  });

  it('replace 硬约束：type=1（UPLOADER）即使同 id 也不被覆盖', () => {
    const importUploader = {
      fav_list: {
        list: [
          {
            id: 'UP1',
            name: 'imported-up',
            type: FavListType.UPLOADER,
            bv_ids: ['BV-imported'],
            create_time: 0,
            update_time: 0,
          },
        ],
      },
      lyrics: { lyricMaps: {} },
      bili_videos: { entities: {}, ids: [] },
    };
    const out = buildMerged(
      {
        fav_list: {
          list: [
            {
              id: 'UP1',
              name: 'current-up',
              type: FavListType.UPLOADER,
              bv_ids: ['BV-current-1', 'BV-current-2'],
              create_time: 100,
              update_time: 100,
            },
          ],
        },
      },
      importUploader,
      'replace',
    );
    // UP 主同 id 项必须保持 current（含 bv_ids），导入版本被丢弃
    const up = out.fav_list.list?.find((it) => it.id === 'UP1');
    expect(up?.name).toBe('current-up');
    expect(up?.bv_ids).toEqual(['BV-current-1', 'BV-current-2']);
  });

  it('replace 硬约束：type=2（BILI_FAV）即使同 id 也不被覆盖', () => {
    const importBiliFav = {
      fav_list: {
        list: [
          {
            id: 'F1',
            name: 'imported-fav',
            type: FavListType.BILI_FAV,
            bv_ids: [],
            create_time: 0,
            update_time: 0,
          },
        ],
      },
      lyrics: { lyricMaps: {} },
      bili_videos: { entities: {}, ids: [] },
    };
    const out = buildMerged(
      {
        fav_list: {
          list: [
            {
              id: 'F1',
              name: 'current-fav',
              type: FavListType.BILI_FAV,
              bv_ids: ['BV-current'],
              create_time: 100,
              update_time: 100,
            },
          ],
        },
      },
      importBiliFav,
      'replace',
    );
    const f = out.fav_list.list?.find((it) => it.id === 'F1');
    expect(f?.name).toBe('current-fav');
    expect(f?.bv_ids).toEqual(['BV-current']);
  });

  it('selectedFavIds：仅勾选项参与 skip 模式', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A')] } },
      importedPayload,
      'skip',
      new Set(['B']),
    );
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'B']);
  });

  it('selectedFavIds：仅勾选项参与 replace 模式', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'replace',
      new Set(['B']),
    );
    // 仅勾选 B（不在 current 里）→ 追加；A 未勾选 → 不参与替换 → 保持 current-A
    const ids = out.fav_list.list?.map((it) => it.id) ?? [];
    expect(new Set(ids)).toEqual(new Set(['A', 'B', 'C']));
    expect(out.fav_list.list?.find((it) => it.id === 'A')?.name).toBe('current-A');
  });

  it('永远不删除 current 中导入没出现的项（C 在两种模式下都保留）', () => {
    const skipOut = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'skip',
    );
    expect(skipOut.fav_list.list?.find((it) => it.id === 'C')?.name).toBe('current-C');

    const replaceOut = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'replace',
    );
    expect(replaceOut.fav_list.list?.find((it) => it.id === 'C')?.name).toBe('current-C');
  });

  it('lyrics replace：导入版本覆盖同 bvid', () => {
    const out = buildMerged(
      {
        lyrics: {
          lyricMaps: { BV1: { bvid: 'BV1', name: 'current-1' } } as never,
        },
      },
      importedPayload,
      'replace',
    );
    // BV1 被导入版本覆盖（imported 中没 name，所以应是 undefined）
    const bv1 = (out.lyrics.lyricMaps as never as Record<string, { name?: string }>).BV1;
    expect(bv1.name).toBeUndefined();
    expect(Object.keys(out.lyrics.lyricMaps ?? {}).sort()).toEqual(['BV1', 'BV2']);
  });

  it('lyrics skip：current 已有的 bvid 不被覆盖', () => {
    const out = buildMerged(
      { lyrics: { lyricMaps: { BV1: { bvid: 'BV1', name: 'current-1' } } as never } },
      importedPayload,
      'skip',
    );
    expect((out.lyrics.lyricMaps as never as Record<string, { name?: string }>).BV1.name).toBe(
      'current-1',
    );
  });

  it('current 为空对象时 skip 等同于全量导入', () => {
    const out = buildMerged({}, importedPayload, 'skip');
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'B']);
    expect(Object.keys(out.lyrics.lyricMaps ?? {}).sort()).toEqual(['BV1', 'BV2']);
  });

  it('bili_videos 总是 union 合并：current 已有的 bvid 不被覆盖（两种模式都成立）', () => {
    const payload = {
      fav_list: { list: [] },
      lyrics: { lyricMaps: {} },
      bili_videos: {
        entities: {
          BV1: { bvid: 'BV1', title: 'imported-1' },
          BV2: { bvid: 'BV2' },
        } as never,
        ids: ['BV1', 'BV2'],
      },
    };
    const currentVideos = {
      bili_videos: {
        entities: { BV1: { bvid: 'BV1', title: 'current-1' } } as never,
        ids: ['BV1'],
      },
    };

    const skipOut = buildMerged(currentVideos, payload, 'skip');
    expect(
      (skipOut.bili_videos.entities as never as Record<string, { title?: string }>).BV1.title,
    ).toBe('current-1');
    expect(skipOut.bili_videos.entities?.BV2).toBeDefined();
    expect(skipOut.bili_videos.ids).toEqual(['BV1', 'BV2']);

    // replace 模式不应覆盖 bili_videos（永远不区分模式）
    const replaceOut = buildMerged(currentVideos, payload, 'replace');
    expect(
      (replaceOut.bili_videos.entities as never as Record<string, { title?: string }>).BV1.title,
    ).toBe('current-1');
  });
});
