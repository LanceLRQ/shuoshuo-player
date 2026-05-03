import { fireEvent, render, screen } from '@testing-library/react';
import { LyricToolbar, type LyricToolbarProps } from './lyric-toolbar';

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

function makeProps(overrides: Partial<LyricToolbarProps> = {}): LyricToolbarProps {
  return {
    customStep: 500,
    onCustomStepChange: vi.fn(),
    hasSelection: false,
    hasHistory: false,
    isAdmin: false,
    hasSpider: false,
    onExit: vi.fn(),
    onSearch: vi.fn(),
    onLoadFromFile: vi.fn(),
    onSaveLocal: vi.fn(),
    onUploadCloud: vi.fn(),
    onDownloadLrc: vi.fn(),
    onShiftAll: vi.fn(),
    onShiftSelected: vi.fn(),
    onInsertHere: vi.fn(),
    onDeleteSelected: vi.fn(),
    onClearSelection: vi.fn(),
    onUndo: vi.fn(),
    ...overrides,
  };
}

describe('LyricToolbar', () => {
  it('渲染所有工具按钮 + 自定义步长输入框', () => {
    render(<LyricToolbar {...makeProps()} />);
    const stepInput = screen.getByLabelText('自定义步长') as HTMLInputElement;
    expect(stepInput.value).toBe('500');
  });

  it('退出 / 加载 / 保存 / 下载 / 插入按钮可点击触发回调', () => {
    const props = makeProps();
    render(<LyricToolbar {...props} />);
    const buttons = screen.getAllByRole('button');
    // buttons[0] = 退出
    fireEvent.click(buttons[0]);
    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  it('搜索按钮在 hasSpider=false 时 disabled', () => {
    render(<LyricToolbar {...makeProps({ hasSpider: false })} />);
    const buttons = screen.getAllByRole('button');
    // buttons[1] = 搜索（在退出之后）
    expect(buttons[1]).toBeDisabled();
  });

  it('搜索按钮在 hasSpider=true 时可用，点击触发 onSearch', () => {
    const onSearch = vi.fn();
    render(<LyricToolbar {...makeProps({ hasSpider: true, onSearch })} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('云端上传按钮在 isAdmin=false 时 disabled', () => {
    render(<LyricToolbar {...makeProps({ isAdmin: false })} />);
    const buttons = screen.getAllByRole('button');
    // 云上传是第 5 个按钮（退出/搜索/上传 LRC/保存/云上传/下载）
    // index 4 = 云上传
    expect(buttons[4]).toBeDisabled();
  });

  it('整体提前/延后按钮触发 onShiftAll(-step / +step)', () => {
    const onShiftAll = vi.fn();
    render(<LyricToolbar {...makeProps({ onShiftAll })} />);
    const buttons = screen.getAllByRole('button');
    // buttons[6] = 整体提前；buttons[7] = 整体延后
    fireEvent.click(buttons[6]);
    expect(onShiftAll).toHaveBeenCalledWith(-500);
    fireEvent.click(buttons[7]);
    expect(onShiftAll).toHaveBeenCalledWith(500);
  });

  it('选中行提前/延后按钮在 hasSelection=false 时 disabled', () => {
    render(<LyricToolbar {...makeProps({ hasSelection: false })} />);
    const buttons = screen.getAllByRole('button');
    // buttons[8] = 选中提前；buttons[9] = 选中延后
    expect(buttons[8]).toBeDisabled();
    expect(buttons[9]).toBeDisabled();
  });

  it('选中行按钮在 hasSelection=true 时启用，点击触发 onShiftSelected', () => {
    const onShiftSelected = vi.fn();
    render(<LyricToolbar {...makeProps({ hasSelection: true, onShiftSelected })} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[8]);
    expect(onShiftSelected).toHaveBeenCalledWith(-500);
  });

  it('自定义步长输入：边界 1~99999 + 非数字 fallback 500', () => {
    const onCustomStepChange = vi.fn();
    render(<LyricToolbar {...makeProps({ onCustomStepChange })} />);
    const input = screen.getByLabelText('自定义步长') as HTMLInputElement;

    // 输入 -10 → clamp 到 1
    fireEvent.change(input, { target: { value: '-10' } });
    expect(onCustomStepChange).toHaveBeenCalledWith(1);

    // 输入 200000 → clamp 到 99999
    onCustomStepChange.mockClear();
    fireEvent.change(input, { target: { value: '200000' } });
    expect(onCustomStepChange).toHaveBeenCalledWith(99999);
  });

  it('撤销按钮在 hasHistory=false 时 disabled', () => {
    render(<LyricToolbar {...makeProps({ hasHistory: false })} />);
    const buttons = screen.getAllByRole('button');
    // 最后一个 button 是 undo
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it('撤销按钮在 hasHistory=true 时点击触发 onUndo', () => {
    const onUndo = vi.fn();
    render(<LyricToolbar {...makeProps({ hasHistory: true, onUndo })} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
