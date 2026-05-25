import { computeHitRows, applyModifierClick, type RowRect } from './use-row-range-selection';

// 行几何：每行高 30，依次排列（无间隙），便于推算命中
const ROWS: RowRect[] = [
  { idx: 0, top: 0, bottom: 30 },
  { idx: 1, top: 30, bottom: 60 },
  { idx: 2, top: 60, bottom: 90 },
  { idx: 3, top: 90, bottom: 120 },
  { idx: 4, top: 120, bottom: 150 },
];

describe('computeHitRows（Y 轴矩形相交命中）', () => {
  it('选框完整覆盖中间几行', () => {
    const hit = computeHitRows(ROWS, { top: 35, bottom: 95 });
    expect([...hit].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('选框上下颠倒（向上拖）结果一致', () => {
    const hit = computeHitRows(ROWS, { top: 95, bottom: 35 });
    expect([...hit].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('选框只擦到行边界也算命中（相交即选）', () => {
    // 60 落在 row1.bottom 与 row2.top 边界
    const hit = computeHitRows(ROWS, { top: 60, bottom: 60 });
    expect([...hit].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('选框完全在所有行之外 → 空集', () => {
    const hit = computeHitRows(ROWS, { top: 200, bottom: 300 });
    expect(hit.size).toBe(0);
  });

  it('选框覆盖全部行', () => {
    const hit = computeHitRows(ROWS, { top: -10, bottom: 999 });
    expect(hit.size).toBe(5);
  });
});

describe('applyModifierClick（修饰键选择变换）', () => {
  it('普通单击 → 单选替换', () => {
    const next = applyModifierClick(new Set([0, 1, 2]), 3, 1, { ctrl: false, shift: false });
    expect([...next]).toEqual([3]);
  });

  it('Ctrl/Cmd 单击未选行 → 追加', () => {
    const next = applyModifierClick(new Set([0, 1]), 3, 1, { ctrl: true, shift: false });
    expect([...next].sort((a, b) => a - b)).toEqual([0, 1, 3]);
  });

  it('Ctrl/Cmd 单击已选行 → 移除（反选）', () => {
    const next = applyModifierClick(new Set([0, 1, 3]), 1, 0, { ctrl: true, shift: false });
    expect([...next].sort((a, b) => a - b)).toEqual([0, 3]);
  });

  it('Shift 单击 → 锚点到当前行连续区间（替换）', () => {
    const next = applyModifierClick(new Set([5]), 5, 2, { ctrl: false, shift: true });
    expect([...next].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
  });

  it('Shift 区间方向无关（idx < anchor）', () => {
    const next = applyModifierClick(new Set(), 1, 4, { ctrl: false, shift: true });
    expect([...next].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('Shift 但无锚点 → 退化为单选', () => {
    const next = applyModifierClick(new Set([0, 1]), 3, null, { ctrl: false, shift: true });
    expect([...next]).toEqual([3]);
  });

  it('不可变：返回新 Set，不改原集合', () => {
    const prev = new Set([0, 1]);
    const next = applyModifierClick(prev, 2, 1, { ctrl: true, shift: false });
    expect(prev).not.toBe(next);
    expect([...prev].sort((a, b) => a - b)).toEqual([0, 1]);
  });
});
