import { fireEvent, render, screen } from '@testing-library/react';
import { LyricTable, type LyricLine } from './lyric-table';
import { LONG_PRESS_MS } from './use-row-range-selection';

const SAMPLE: LyricLine[] = [
  { time: 0, content: 'Line A' },
  { time: 5000, content: 'Line B' },
  { time: 10000, content: 'Line C' },
];

function makeProps(overrides: Partial<React.ComponentProps<typeof LyricTable>> = {}) {
  return {
    lines: SAMPLE,
    selectedRows: new Set<number>(),
    setSelectedRows: vi.fn(),
    currentMillisecond: 0,
    onSeek: vi.fn(),
    onToggleSelect: vi.fn(),
    onToggleSelectAll: vi.fn(),
    onUpdateLine: vi.fn(),
    ...overrides,
  };
}

describe('LyricTable', () => {
  it('渲染表头 + 行（非编辑态显示文本）', () => {
    render(<LyricTable {...makeProps()} />);
    expect(screen.getByRole('columnheader', { name: '时间' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '歌词内容' })).toBeInTheDocument();
    expect(screen.getByText('Line A')).toBeInTheDocument();
    expect(screen.getByText('Line C')).toBeInTheDocument();
  });

  it('lines 为空 → 显示"暂无歌词"占位', () => {
    render(<LyricTable {...makeProps({ lines: [] })} />);
    expect(screen.getByText('暂无歌词')).toBeInTheDocument();
  });

  it('全选 checkbox：点击触发 onToggleSelectAll(true)', () => {
    const onToggleSelectAll = vi.fn();
    render(<LyricTable {...makeProps({ onToggleSelectAll })} />);
    fireEvent.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);
  });

  it('selectedRows 全选时全选 checkbox 处于选中态', () => {
    render(<LyricTable {...makeProps({ selectedRows: new Set([0, 1, 2]) })} />);
    expect(screen.getByRole('checkbox', { name: '全选' }).getAttribute('data-state')).toBe(
      'checked',
    );
  });

  it('双击内容格进入编辑 → 修改 → onBlur commit 触发 onUpdateLine', () => {
    const onUpdateLine = vi.fn();
    render(<LyricTable {...makeProps({ onUpdateLine })} />);
    fireEvent.doubleClick(screen.getByText('Line A'));
    const inputA = screen.getByDisplayValue('Line A');
    fireEvent.change(inputA, { target: { value: 'Modified A' } });
    fireEvent.blur(inputA);
    expect(onUpdateLine).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ content: 'Modified A', time: 0 }),
    );
  });

  it('单击内容格不进入编辑（仅双击才编辑）', () => {
    render(<LyricTable {...makeProps()} />);
    fireEvent.click(screen.getByText('Line A'));
    expect(screen.queryByDisplayValue('Line A')).toBeNull();
  });

  it('当前播放行根据 currentMillisecond 计算（最后一个 time<=cur）', () => {
    const { container } = render(<LyricTable {...makeProps({ currentMillisecond: 7000 })} />);
    expect(container.querySelector('[data-row="1"]')).toBeTruthy();
  });

  it('点击悬停跳转按钮触发 onSeek（行的 time 毫秒）', () => {
    const onSeek = vi.fn();
    render(<LyricTable {...makeProps({ onSeek, isPlaying: true })} />);
    const seekBtns = screen.getAllByLabelText('跳播放到该句');
    fireEvent.click(seekBtns[1]); // 第二行 time=5000
    expect(onSeek).toHaveBeenCalledWith(5000);
  });
});

describe('LyricTable 框选与多选交互', () => {
  // jsdom getBoundingClientRect 恒 0：按 data-row 注入几何（行高 30 依次排列），
  // 容器返回视口大矩形，使命中算法可断言。
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const dr = this.getAttribute('data-row');
      if (dr != null) {
        const i = Number(dr);
        return {
          top: i * 30,
          bottom: i * 30 + 30,
          left: 0,
          right: 200,
          width: 200,
          height: 30,
          x: 0,
          y: i * 30,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        top: 0,
        bottom: 300,
        left: 0,
        right: 200,
        width: 200,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const row = (container: HTMLElement, idx: number) =>
    container.querySelector(`[data-row="${idx}"]`) as HTMLElement;

  it('单击行 → 单选该行（替换）', () => {
    const setSelectedRows = vi.fn();
    const { container } = render(<LyricTable {...makeProps({ setSelectedRows })} />);
    fireEvent.click(row(container, 1));
    expect(setSelectedRows).toHaveBeenCalledTimes(1);
    expect([...setSelectedRows.mock.calls[0][0]]).toEqual([1]);
  });

  it('Ctrl/Cmd 单击已选行 → 移除（反选）', () => {
    const setSelectedRows = vi.fn();
    const { container } = render(
      <LyricTable {...makeProps({ selectedRows: new Set([0, 1]), setSelectedRows })} />,
    );
    fireEvent.click(row(container, 0), { ctrlKey: true });
    expect([...setSelectedRows.mock.calls[0][0]].sort((a, b) => a - b)).toEqual([1]);
  });

  it('Shift 单击 → 锚点到当前行连续区间', () => {
    const setSelectedRows = vi.fn();
    const { container } = render(<LyricTable {...makeProps({ setSelectedRows })} />);
    fireEvent.click(row(container, 0)); // 设锚点 0
    fireEvent.click(row(container, 2), { shiftKey: true });
    const last = setSelectedRows.mock.calls.at(-1)![0] as Set<number>;
    expect([...last].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('点复选框方块 → 走 onToggleSelect，不触发行单选', () => {
    const setSelectedRows = vi.fn();
    const onToggleSelect = vi.fn();
    render(<LyricTable {...makeProps({ setSelectedRows, onToggleSelect })} />);
    fireEvent.click(screen.getByLabelText('选择第 1 行'));
    expect(onToggleSelect).toHaveBeenCalledWith(0, true);
    expect(setSelectedRows).not.toHaveBeenCalled();
  });

  it('点跳转按钮 → 触发 seek，不触发行单选', () => {
    const setSelectedRows = vi.fn();
    const onSeek = vi.fn();
    render(<LyricTable {...makeProps({ setSelectedRows, onSeek, isPlaying: true })} />);
    fireEvent.click(screen.getAllByLabelText('跳播放到该句')[0]);
    expect(onSeek).toHaveBeenCalledWith(0);
    expect(setSelectedRows).not.toHaveBeenCalled();
  });

  it('整行拖动框选 → 命中行写入选择集', () => {
    const setSelectedRows = vi.fn();
    const { container } = render(<LyricTable {...makeProps({ setSelectedRows })} />);
    fireEvent.mouseDown(row(container, 0), { button: 0, clientX: 5, clientY: 5 });
    vi.advanceTimersByTime(LONG_PRESS_MS); // 快进长按计时器
    fireEvent.mouseMove(window, { clientX: 5, clientY: 95 });
    fireEvent.mouseUp(window);
    expect(setSelectedRows).toHaveBeenCalled();
    const last = setSelectedRows.mock.calls.at(-1)![0] as Set<number>;
    expect([...last].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('编辑态禁用拖动框选', () => {
    const setSelectedRows = vi.fn();
    const { container } = render(<LyricTable {...makeProps({ setSelectedRows })} />);
    fireEvent.doubleClick(screen.getByText('Line A')); // 双击进入内容编辑态
    setSelectedRows.mockClear();
    fireEvent.mouseDown(row(container, 0), { button: 0, clientX: 5, clientY: 5 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fireEvent.mouseMove(window, { clientX: 5, clientY: 95 });
    fireEvent.mouseUp(window);
    expect(setSelectedRows).not.toHaveBeenCalled();
  });

  it('拖动结束后的尾随 dblclick 不进入编辑', () => {
    const { container } = render(<LyricTable {...makeProps()} />);
    fireEvent.mouseDown(row(container, 0), { button: 0, clientX: 5, clientY: 5 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fireEvent.mouseMove(window, { clientX: 5, clientY: 95 });
    fireEvent.mouseUp(window);
    fireEvent.doubleClick(screen.getByText('Line A'));
    expect(screen.queryByDisplayValue('Line A')).toBeNull();
  });

  it('滚动后框选不丢失滚出可视区的行（起点内容坐标固定）', () => {
    const FIVE: LyricLine[] = [
      { time: 0, content: 'R0' },
      { time: 1000, content: 'R1' },
      { time: 2000, content: 'R2' },
      { time: 3000, content: 'R3' },
      { time: 4000, content: 'R4' },
    ];
    let scrollTop = 0;
    const setSelectedRows = vi.fn();
    const { container } = render(<LyricTable {...makeProps({ lines: FIVE, setSelectedRows })} />);
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement;
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    });
    // 容器可视高 90（约 3 行）；行视口坐标 = 内容坐标 - scrollTop
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const dr = this.getAttribute('data-row');
      if (dr != null) {
        const i = Number(dr);
        const top = i * 30 - scrollTop;
        return {
          top,
          bottom: top + 30,
          left: 0,
          right: 200,
          width: 200,
          height: 30,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        top: 0,
        bottom: 90,
        left: 0,
        right: 200,
        width: 200,
        height: 90,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    // 在 row0 顶部起拖（scrollTop=0，固定起点内容 y=5）
    fireEvent.mouseDown(row(container, 0), { button: 0, clientX: 5, clientY: 5 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    // 模拟列表已自动滚动 60px（row0/row1 滚出顶部不可视）
    scrollTop = 60;
    // 当前指针在可视区中部（clientY=50 → 内容坐标 110）
    fireEvent.mouseMove(window, { clientX: 5, clientY: 50 });
    fireEvent.mouseUp(window);

    const last = setSelectedRows.mock.calls.at(-1)![0] as Set<number>;
    // 起点固定在内容 y=5（row0）：即便 row0/row1 已滚出可视区，仍被命中，不丢失
    expect([...last].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
});
