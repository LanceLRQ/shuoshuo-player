import { fireEvent, render, screen } from '@testing-library/react';
import { LyricTable, type LyricLine } from './lyric-table';

// jsdom 不实现 Element.scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const SAMPLE: LyricLine[] = [
  { time: 0, content: 'Line A' },
  { time: 5000, content: 'Line B' },
  { time: 10000, content: 'Line C' },
];

function makeProps(overrides: Partial<React.ComponentProps<typeof LyricTable>> = {}) {
  return {
    lines: SAMPLE,
    selectedRows: new Set<number>(),
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
    // 非编辑态直接显示文本（点击单元格后才进入 editing 模式）
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
    const allCheckbox = screen.getByRole('checkbox', { name: '全选' });
    fireEvent.click(allCheckbox);
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);
  });

  it('selectedRows 全选时全选 checkbox 处于选中态', () => {
    render(<LyricTable {...makeProps({ selectedRows: new Set([0, 1, 2]) })} />);
    const allCheckbox = screen.getByRole('checkbox', { name: '全选' });
    expect(allCheckbox.getAttribute('data-state')).toBe('checked');
  });

  it('点击单元格进入编辑态 → 修改内容 → onBlur commit 触发 onUpdateLine', () => {
    const onUpdateLine = vi.fn();
    render(<LyricTable {...makeProps({ onUpdateLine })} />);

    // 先点击 Line A 单元格进入编辑态
    const cellA = screen.getByText('Line A');
    fireEvent.click(cellA);

    // 编辑态显示 Input
    const inputA = screen.getByDisplayValue('Line A');
    fireEvent.change(inputA, { target: { value: 'Modified A' } });
    fireEvent.blur(inputA);

    expect(onUpdateLine).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ content: 'Modified A', time: 0 }),
    );
  });

  it('当前播放行根据 currentMillisecond 计算（最后一个 time<=cur）', () => {
    const { container } = render(<LyricTable {...makeProps({ currentMillisecond: 7000 })} />);
    // currentLineIdx=1（time=5000 ≤ 7000 < 10000）
    const currentRow = container.querySelector('[data-row="1"]');
    expect(currentRow).toBeTruthy();
  });

  it('双击行触发 onSeek（行的 time 毫秒）', () => {
    const onSeek = vi.fn();
    const { container } = render(<LyricTable {...makeProps({ onSeek })} />);
    const row = container.querySelector('[data-row="1"]') as HTMLElement;
    fireEvent.doubleClick(row);
    expect(onSeek).toHaveBeenCalledWith(5000);
  });
});
