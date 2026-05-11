import { fireEvent, render, screen } from '@testing-library/react';
import { LyricCompareView } from './lyric-compare-view';
import type { LyricLine } from './lyric-table';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  // jsdom 默认未实现 scrollIntoView；LyricTable 内部 useEffect 会调用，需 stub
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const MAIN: LyricLine[] = [{ time: 0, content: 'main 1' }];
const SUGGESTED: LyricLine[] = [
  { time: 0, content: 'sug 1' },
  { time: 2000, content: 'sug 2' },
];

function makeProps(over: Partial<React.ComponentProps<typeof LyricCompareView>> = {}) {
  return {
    mainLines: MAIN,
    mainSelectedRows: new Set<number>(),
    currentMillisecond: 0,
    onMainSeek: vi.fn(),
    onMainToggleSelect: vi.fn(),
    onMainToggleSelectAll: vi.fn(),
    onMainUpdateLine: vi.fn(),
    suggestedLines: SUGGESTED,
    suggestedSelected: new Set<number>(),
    onSuggestedToggleSelect: vi.fn(),
    onSuggestedToggleSelectAll: vi.fn(),
    onOverwrite: vi.fn(),
    onInsertSelected: vi.fn(),
    onInsertAll: vi.fn(),
    onClearSuggested: vi.fn(),
    ...over,
  };
}

describe('LyricCompareView', () => {
  it('渲染左右两列标题 + 行数', () => {
    render(<LyricCompareView {...makeProps()} />);
    expect(screen.getByText('当前歌词（可编辑）')).toBeInTheDocument();
    // 暂存列标题缩短为"暂存歌词"，原副文字（搜索结果 / 文件加载）改放 title attr
    expect(screen.getByText('暂存歌词')).toBeInTheDocument();
    // 两列各自的"X 行"
    expect(screen.getByText('1 行')).toBeInTheDocument();
    expect(screen.getByText('2 行')).toBeInTheDocument();
  });

  it('暂存为空 → 覆盖 / 插入全部 / 清空 三个按钮 disabled', () => {
    render(<LyricCompareView {...makeProps({ suggestedLines: [] })} />);
    expect(screen.getByRole('button', { name: '覆盖' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '插入全部' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '清空暂存' })).toBeDisabled();
  });

  it('暂存无选中 → 插入选中 disabled；选中后启用', () => {
    const { rerender } = render(<LyricCompareView {...makeProps()} />);
    expect(screen.getByRole('button', { name: '插入选中' })).toBeDisabled();

    rerender(<LyricCompareView {...makeProps({ suggestedSelected: new Set([0]) })} />);
    expect(screen.getByRole('button', { name: '插入选中' })).not.toBeDisabled();
  });

  it('点击"覆盖"触发 onOverwrite', () => {
    const onOverwrite = vi.fn();
    render(<LyricCompareView {...makeProps({ onOverwrite })} />);
    fireEvent.click(screen.getByRole('button', { name: '覆盖' }));
    expect(onOverwrite).toHaveBeenCalledTimes(1);
  });

  it('点击"插入选中"触发 onInsertSelected', () => {
    const onInsertSelected = vi.fn();
    render(
      <LyricCompareView {...makeProps({ suggestedSelected: new Set([0, 1]), onInsertSelected })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '插入选中' }));
    expect(onInsertSelected).toHaveBeenCalledTimes(1);
  });

  it('点击"插入全部"触发 onInsertAll', () => {
    const onInsertAll = vi.fn();
    render(<LyricCompareView {...makeProps({ onInsertAll })} />);
    fireEvent.click(screen.getByRole('button', { name: '插入全部' }));
    expect(onInsertAll).toHaveBeenCalledTimes(1);
  });

  it('点击"清空"触发 onClearSuggested', () => {
    const onClearSuggested = vi.fn();
    render(<LyricCompareView {...makeProps({ onClearSuggested })} />);
    fireEvent.click(screen.getByRole('button', { name: '清空暂存' }));
    expect(onClearSuggested).toHaveBeenCalledTimes(1);
  });
});
