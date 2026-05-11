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
 *
 * 末尾追加 spider 解析渲染测：验证未传 prop 时从 PlatformBridge 自取，
 * 修复 lyric-list 弹窗 / lyric-viewer 内嵌 LyricEditor 不传 spider 导致
 * PC 端搜索按钮被误隐藏的回归。
 */
import { render, screen } from '@testing-library/react';
import {
  LYRIC_EDITOR_UNDO_STACK_MAX,
  setPlatformBridge,
  resetPlatformBridge,
  type PlatformBridge,
  type SpiderAdapter,
  type BilibiliVideo,
} from '@shuoshuo-player/shared';
import { appendLyricHistory, LyricEditor } from './lyric-editor';
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

/**
 * spider 解析回归：caller 不传 spider prop 时，从 PlatformBridge 自取
 *
 * 历史回归：lyric-viewer / lyric-list 弹窗均未透传 spider，
 * 导致 PC 端搜索按钮被 hasSpider=false 误隐藏。
 */
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const VIDEO: BilibiliVideo = {
  aid: 0,
  bvid: 'BV1',
  created: 0,
  length: '',
  pic: '',
  is_union_video: false,
  title: 't',
  sub_title: '',
  play: 0,
  comment: 0,
  author: '',
  description: '',
};

function makeSpider(): SpiderAdapter {
  return {
    searchSong: vi.fn(async () => []),
    getLRC: vi.fn(async () => ''),
  };
}

function injectBridge(spider?: SpiderAdapter) {
  const bridge: PlatformBridge = {
    type: 'tauri',
    storage: {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
    auth: {
      login: async () => {},
      logout: async () => {},
      onLoginSuccess: () => () => {},
    },
    shell: { openExternal: async () => {} },
    spider,
  };
  setPlatformBridge(bridge);
}

/**
 * 锚定搜索按钮：lucide-react 渲染的 svg 自带 `lucide-search` class，
 * 比按钮索引/aria-label 都稳（无 i18n / 顺序变更敏感问题）
 */
function findSearchButton(container: HTMLElement): HTMLElement | null {
  const svg = container.querySelector('.lucide-search');
  return svg ? svg.closest('button') : null;
}

describe('LyricEditor spider 解析（PlatformBridge 自取）', () => {
  afterEach(() => {
    resetPlatformBridge();
  });

  it('未传 spider prop 但 PlatformBridge.spider 存在 → 工具栏渲染搜索按钮', () => {
    injectBridge(makeSpider());
    const { container } = render(
      <LyricEditor currentVideo={VIDEO} currentTime={0} onExit={vi.fn()} />,
    );
    expect(findSearchButton(container)).not.toBeNull();
  });

  it('未传 spider prop 且 PlatformBridge.spider 缺失 → 搜索按钮不渲染', () => {
    injectBridge(undefined);
    const { container } = render(
      <LyricEditor currentVideo={VIDEO} currentTime={0} onExit={vi.fn()} />,
    );
    expect(findSearchButton(container)).toBeNull();
  });

  it('PlatformBridge 未初始化（getPlatformBridge 抛错）→ 静默 fallback 为 undefined', () => {
    // 不调 setPlatformBridge → bridge.ts 内部状态为 null → getPlatformBridge() 抛错
    // 期望 LyricEditor 不传染抛错，搜索按钮不渲染（hasSpider=false）
    expect(() =>
      render(<LyricEditor currentVideo={VIDEO} currentTime={0} onExit={vi.fn()} />),
    ).not.toThrow();
    expect(findSearchButton(screen.getByText('暂无歌词').closest('div')!)).toBeNull();
  });

  it('显式传入 spider prop → 优先生效，覆盖 PlatformBridge', () => {
    // bridge 未挂 spider，但 prop 传了 → 按钮应渲染
    injectBridge(undefined);
    const override = makeSpider();
    const { container } = render(
      <LyricEditor currentVideo={VIDEO} currentTime={0} onExit={vi.fn()} spider={override} />,
    );
    expect(findSearchButton(container)).not.toBeNull();
  });
});
