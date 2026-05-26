import { fireEvent, render, screen } from '@testing-library/react';
import { LyricSuggestedTable } from './lyric-suggested-table';
import type { LyricLine } from './lyric-table';

const LINES: LyricLine[] = [
  { time: 0, content: 'Line A' },
  { time: 1500, content: 'Line B' },
  { time: 3000, content: '' },
];

function makeProps(overrides: Partial<React.ComponentProps<typeof LyricSuggestedTable>> = {}) {
  return {
    lines: LINES,
    selectedRows: new Set<number>(),
    setSelectedRows: vi.fn(),
    currentMillisecond: 0,
    onToggleSelect: vi.fn(),
    onToggleSelectAll: vi.fn(),
    ...overrides,
  };
}

describe('LyricSuggestedTable', () => {
  it('lines 为空时显示占位文案', () => {
    render(<LyricSuggestedTable {...makeProps({ lines: [] })} />);
    expect(screen.getByText('暂无暂存歌词')).toBeInTheDocument();
  });

  it('渲染所有行的时间 / 内容 + 空行 fallback', () => {
    render(<LyricSuggestedTable {...makeProps()} />);
    expect(screen.getByText('Line A')).toBeInTheDocument();
    expect(screen.getByText('Line B')).toBeInTheDocument();
    // 空 content 显示"（空）"占位
    expect(screen.getByText('（空）')).toBeInTheDocument();
  });

  it('点击单行 checkbox 触发 onToggleSelect', () => {
    const onToggleSelect = vi.fn();
    render(<LyricSuggestedTable {...makeProps({ onToggleSelect })} />);
    const cb = screen.getByLabelText('选择暂存第 1 行');
    fireEvent.click(cb);
    expect(onToggleSelect).toHaveBeenCalledWith(0, true);
  });

  it('点击全选 checkbox 触发 onToggleSelectAll', () => {
    const onToggleSelectAll = vi.fn();
    render(<LyricSuggestedTable {...makeProps({ onToggleSelectAll })} />);
    fireEvent.click(screen.getByLabelText('全选暂存'));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);
  });

  it('selectedRows 为全部 → 全选 checkbox 处于 checked 状态', () => {
    const allSelected = new Set([0, 1, 2]);
    render(<LyricSuggestedTable {...makeProps({ selectedRows: allSelected })} />);
    const cb = screen.getByLabelText('全选暂存') as HTMLInputElement;
    expect(cb.getAttribute('aria-checked')).toBe('true');
  });

  it('双击某行触发 onSeek（毫秒）', () => {
    const onSeek = vi.fn();
    render(<LyricSuggestedTable {...makeProps({ onSeek })} />);
    fireEvent.doubleClick(screen.getByText('Line B'));
    expect(onSeek).toHaveBeenCalledWith(1500);
  });
});
