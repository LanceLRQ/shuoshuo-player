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
  };

  it('append：仅添加 current 不存在的项；A 保持现有内容', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'append',
    );
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'C', 'B']);
    // A 保持现有内容（current-A），不被 imported 覆盖
    expect(out.fav_list.list?.find((it) => it.id === 'A')?.name).toBe('current-A');
  });

  it('replaceAndAppend：A 被覆盖，B 新增，C 保留', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'replaceAndAppend',
    );
    const ids = out.fav_list.list?.map((it) => it.id) ?? [];
    expect(new Set(ids)).toEqual(new Set(['A', 'B', 'C']));
    // A 被替换为导入版本
    expect(out.fav_list.list?.find((it) => it.id === 'A')?.name).toBe('imported-A');
    // C 保留
    expect(out.fav_list.list?.find((it) => it.id === 'C')?.name).toBe('current-C');
  });

  it('overwrite：current 被清空，仅剩导入项', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A'), v2Item('C', 'current-C')] } },
      importedPayload,
      'overwrite',
    );
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'B']);
    expect(out.fav_list.list?.find((it) => it.id === 'A')?.name).toBe('imported-A');
  });

  it('selectedFavIds：仅勾选项参与 append', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('A', 'current-A')] } },
      importedPayload,
      'append',
      new Set(['B']),
    );
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'B']);
  });

  it('overwrite 模式下 selectedFavIds 被忽略（强制全部）', () => {
    const out = buildMerged(
      { fav_list: { list: [v2Item('Z')] } },
      importedPayload,
      'overwrite',
      new Set(['B']),
    );
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'B']);
  });

  it('lyrics 始终全量按 mode 合并（不受 selectedFavIds 影响）', () => {
    const current = { lyrics: { lyricMaps: { BVx: { bvid: 'BVx' } } as never } };
    const append = buildMerged(current, importedPayload, 'append', new Set(['A']));
    expect(Object.keys(append.lyrics.lyricMaps ?? {}).sort()).toEqual(['BV1', 'BV2', 'BVx']);

    const overwrite = buildMerged(current, importedPayload, 'overwrite');
    expect(Object.keys(overwrite.lyrics.lyricMaps ?? {}).sort()).toEqual(['BV1', 'BV2']);
  });

  it('lyrics append：current 已有的 bvid 不被覆盖', () => {
    const out = buildMerged(
      { lyrics: { lyricMaps: { BV1: { bvid: 'BV1', name: 'current-1' } } as never } },
      importedPayload,
      'append',
    );
    expect((out.lyrics.lyricMaps as never as Record<string, { name?: string }>).BV1.name).toBe(
      'current-1',
    );
  });

  it('current 为空对象时 append 等同于全量导入', () => {
    const out = buildMerged({}, importedPayload, 'append');
    expect(out.fav_list.list?.map((it) => it.id)).toEqual(['A', 'B']);
    expect(Object.keys(out.lyrics.lyricMaps ?? {}).sort()).toEqual(['BV1', 'BV2']);
  });
});
