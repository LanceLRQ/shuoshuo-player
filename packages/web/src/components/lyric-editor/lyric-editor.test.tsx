/**
 * H2: lyric-editor 撤销栈深度限制单测
 *
 * 通过 export 出来的纯函数 appendLyricHistory 验证：
 * - 连续 1000 次操作后栈深度恒为 LYRIC_EDITOR_UNDO_STACK_MAX (999)
 * - 第 0 条被 FIFO 丢弃
 * - undo 顺序正确（pop 顺序与 push 倒序一致）
 *
 * 选择测纯函数而非组件级触发 1000 次 click，是为了：
 * - 隔离 React setState 异步、避免 RAF 等待
 * - 让用例对组件渲染细节解耦，未来 UI 重构不破坏覆盖
 */
import { LYRIC_EDITOR_UNDO_STACK_MAX } from '@shuoshuo-player/shared';
import { appendLyricHistory } from './lyric-editor';
import type { LyricLine } from './lyric-table';

const makeLine = (i: number): LyricLine => ({ time: i * 1000, content: `L${i}` });

describe('H2: appendLyricHistory 撤销栈追加', () => {
  it('LYRIC_EDITOR_UNDO_STACK_MAX 常量值为 999（与 plans/phase-2 §2.2 对齐）', () => {
    expect(LYRIC_EDITOR_UNDO_STACK_MAX).toBe(999);
  });

  it('未达上限时正常追加', () => {
    let stack: LyricLine[][] = [];
    for (let i = 0; i < 5; i++) {
      stack = appendLyricHistory(stack, [makeLine(i)]);
    }
    expect(stack).toHaveLength(5);
    expect(stack[0]).toEqual([makeLine(0)]);
    expect(stack[4]).toEqual([makeLine(4)]);
  });

  it('达到上限后再 push 一次：栈深度不变，最早一条被丢弃', () => {
    let stack: LyricLine[][] = [];
    for (let i = 0; i < LYRIC_EDITOR_UNDO_STACK_MAX; i++) {
      stack = appendLyricHistory(stack, [makeLine(i)]);
    }
    expect(stack).toHaveLength(LYRIC_EDITOR_UNDO_STACK_MAX);

    stack = appendLyricHistory(stack, [makeLine(LYRIC_EDITOR_UNDO_STACK_MAX)]);
    expect(stack).toHaveLength(LYRIC_EDITOR_UNDO_STACK_MAX);
    expect(stack[0]).toEqual([makeLine(1)]);
    expect(stack[stack.length - 1]).toEqual([makeLine(LYRIC_EDITOR_UNDO_STACK_MAX)]);
  });

  it('连续 1000 次推入后：栈深恒为 999，第 0 条已被丢弃', () => {
    let stack: LyricLine[][] = [];
    for (let i = 0; i < 1000; i++) {
      stack = appendLyricHistory(stack, [makeLine(i)]);
    }
    expect(stack).toHaveLength(LYRIC_EDITOR_UNDO_STACK_MAX);
    // 第 0 条（索引 0 = makeLine(0)）已被丢弃，最早的是 makeLine(1)
    expect(stack[0]).toEqual([makeLine(1)]);
    expect(stack[stack.length - 1]).toEqual([makeLine(999)]);
  });

  it('连续 5000 次推入：栈深仍为 999，最早保留 makeLine(4001)', () => {
    let stack: LyricLine[][] = [];
    for (let i = 0; i < 5000; i++) {
      stack = appendLyricHistory(stack, [makeLine(i)]);
    }
    expect(stack).toHaveLength(LYRIC_EDITOR_UNDO_STACK_MAX);
    expect(stack[0]).toEqual([makeLine(5000 - LYRIC_EDITOR_UNDO_STACK_MAX)]);
    expect(stack[stack.length - 1]).toEqual([makeLine(4999)]);
  });

  it('返回新数组（不变性，不影响入参）', () => {
    const original: LyricLine[][] = [[makeLine(0)]];
    const result = appendLyricHistory(original, [makeLine(1)]);
    expect(original).toHaveLength(1);
    expect(result).not.toBe(original);
    expect(result).toHaveLength(2);
  });

  it('snapshot 引用透传（push 的元素与传入相同引用）', () => {
    const snap: LyricLine[] = [makeLine(99)];
    const stack = appendLyricHistory([], snap);
    expect(stack[0]).toBe(snap);
  });

  it('undo 顺序：栈尾即最近一次操作', () => {
    let stack: LyricLine[][] = [];
    const snaps = [[makeLine(1)], [makeLine(2)], [makeLine(3)]];
    for (const s of snaps) stack = appendLyricHistory(stack, s);

    // pop 顺序应当与 push 倒序一致
    const popped: LyricLine[][] = [];
    while (stack.length > 0) {
      const last = stack[stack.length - 1];
      popped.push(last);
      stack = stack.slice(0, -1);
    }
    expect(popped).toEqual([snaps[2], snaps[1], snaps[0]]);
  });
});
