import { asRecord } from './type-guards';

describe('asRecord', () => {
  it('普通对象 → 原对象', () => {
    const obj = { a: 1 };
    expect(asRecord(obj)).toBe(obj);
  });

  it('数组 → 也视为对象（typeof === object）', () => {
    expect(asRecord([1, 2, 3])).not.toBeNull();
  });

  it('null → null', () => {
    expect(asRecord(null)).toBeNull();
  });

  it('undefined → null', () => {
    expect(asRecord(undefined)).toBeNull();
  });

  it('原始值 → null', () => {
    expect(asRecord('string')).toBeNull();
    expect(asRecord(123)).toBeNull();
    expect(asRecord(true)).toBeNull();
  });
});
