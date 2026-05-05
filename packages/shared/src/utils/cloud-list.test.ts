import { pickCloudList, pickCloudListTotal } from './cloud-list';

describe('cloud-list 解包工具', () => {
  describe('pickCloudList — v2 normalized 形态（带 entityKey/resultKey）', () => {
    const NORMALIZED_RESP = {
      entities: {
        lyric: {
          '116': { id: 116, bvid: 'BV1', title: 'A' },
          '117': { id: 117, bvid: 'BV2', title: 'B' },
          '118': { id: 118, bvid: 'BV3', title: 'C' },
        },
      },
      result: { lyrics: ['117', '118', '116'] },
      pagination: { page: 1, pageSize: 20, total: 135 },
    };

    it('按 result 顺序从 entities 字典查表组装数组', () => {
      const items = pickCloudList(NORMALIZED_RESP as never, {
        entityKey: 'lyric',
        resultKey: 'lyrics',
      });
      expect(items.map((x) => (x as { id: number }).id)).toEqual([117, 118, 116]);
    });

    it('result 中存在 entities 缺失的 id：跳过该项不抛错', () => {
      const items = pickCloudList(
        {
          entities: { lyric: { '116': { id: 116 } } },
          result: { lyrics: ['116', '999', '888'] },
        } as never,
        { entityKey: 'lyric', resultKey: 'lyrics' },
      );
      expect(items).toEqual([{ id: 116 }]);
    });

    it('entityKey/resultKey 不匹配后端字段：返回 []', () => {
      const items = pickCloudList(NORMALIZED_RESP as never, {
        entityKey: 'wrong',
        resultKey: 'lyrics',
      });
      expect(items).toEqual([]);
    });
  });

  describe('pickCloudList — v1 兼容形态（不带 keys）', () => {
    it('result 字段是数组：直接返回', () => {
      expect(pickCloudList({ result: [1, 2, 3] } as never)).toEqual([1, 2, 3]);
    });

    it('result 缺省 fallback 到 list', () => {
      expect(pickCloudList({ list: ['a'] } as never)).toEqual(['a']);
    });

    it('result 数组优先于 list（兼容字段并存）', () => {
      expect(pickCloudList({ result: [1], list: [9] } as never)).toEqual([1]);
    });

    it('null / undefined / 空对象：返回 []', () => {
      expect(pickCloudList(null)).toEqual([]);
      expect(pickCloudList(undefined)).toEqual([]);
      expect(pickCloudList({} as never)).toEqual([]);
    });

    // 后端把 list/result 写成非数组的情形（实际生产中遇到过），
    // ?? 不会兜住对象/字符串等非 nullish 值，必须 Array.isArray 防御
    it('result 是非数组对象但未传 keys：fallback 到 list / 返回 []', () => {
      expect(pickCloudList({ result: { lyrics: ['1'] } } as never)).toEqual([]);
      expect(pickCloudList({ result: { lyrics: ['1'] }, list: ['x'] } as never)).toEqual(['x']);
    });

    it('result 是非数组（字符串 / 数字 / 布尔）：返回 []', () => {
      expect(pickCloudList({ result: 'oops' } as never)).toEqual([]);
      expect(pickCloudList({ result: 0 } as never)).toEqual([]);
      expect(pickCloudList({ result: false } as never)).toEqual([]);
    });

    it('list 是非数组：同样返回 []', () => {
      expect(pickCloudList({ list: { items: [] } } as never)).toEqual([]);
    });
  });

  describe('pickCloudListTotal', () => {
    it('pager.total 优先', () => {
      expect(pickCloudListTotal({ pager: { total: 42 } } as never, 0)).toBe(42);
    });

    it('pagination.total 兼容', () => {
      expect(pickCloudListTotal({ pagination: { total: 7 } } as never, 0)).toBe(7);
    });

    it('两者都没有：返回 fallback', () => {
      expect(pickCloudListTotal({} as never, 5)).toBe(5);
      expect(pickCloudListTotal(null, 3)).toBe(3);
    });

    it('total 不是有限数字（NaN / 字符串 / 对象）：fallback 兜底', () => {
      expect(pickCloudListTotal({ pager: { total: NaN } } as never, 8)).toBe(8);
      expect(pickCloudListTotal({ pager: { total: '12' } } as never, 8)).toBe(8);
      expect(pickCloudListTotal({ pager: { total: {} } } as never, 8)).toBe(8);
    });
  });
});
