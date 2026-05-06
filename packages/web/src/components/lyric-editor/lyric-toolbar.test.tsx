import { fireEvent, render, screen, within } from '@testing-library/react';
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
  // hasSpider 默认开启：让按钮索引稳定（搜索按钮存在），
  // hasSpider=false 的隐藏行为单独用例验证
  return {
    customStep: 500,
    onCustomStepChange: vi.fn(),
    hasSelection: false,
    hasHistory: false,
    isAdmin: false,
    hasSpider: true,
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
    onEditSource: vi.fn(),
    ...overrides,
  };
}

/**
 * 按渲染顺序的非 IO 按钮：
 * 0=退出 1=搜索 2=整体提前 3=整体延后 4=选中提前 5=选中延后
 * 6=插入 7=删除 8=清空选择 9=撤销
 * IO 组（加载/保存/上传/下载）通过 data-testid="lyric-toolbar-io-group" 定位
 */

describe('LyricToolbar', () => {
  it('渲染所有工具按钮 + 自定义步长输入框', () => {
    render(<LyricToolbar {...makeProps()} />);
    const stepInput = screen.getByLabelText('自定义步长') as HTMLInputElement;
    expect(stepInput.value).toBe('500');
  });

  it('退出按钮可点击触发回调', () => {
    const props = makeProps();
    render(<LyricToolbar {...props} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  it('搜索按钮在 hasSpider=false 时完全不渲染（浏览器端避免诱饵按钮）', () => {
    const withSpider = render(<LyricToolbar {...makeProps({ hasSpider: true })} />);
    const totalWithSpider = withSpider.container.querySelectorAll('button').length;
    withSpider.unmount();

    render(<LyricToolbar {...makeProps({ hasSpider: false })} />);
    const totalWithoutSpider = screen.getAllByRole('button').length;
    expect(totalWithoutSpider).toBe(totalWithSpider - 1);
  });

  it('搜索按钮在 hasSpider=true 时可用，点击触发 onSearch', () => {
    const onSearch = vi.fn();
    render(<LyricToolbar {...makeProps({ hasSpider: true, onSearch })} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('整体提前/延后按钮触发 onShiftAll(-step / +step)', () => {
    const onShiftAll = vi.fn();
    render(<LyricToolbar {...makeProps({ onShiftAll })} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]);
    expect(onShiftAll).toHaveBeenCalledWith(-500);
    fireEvent.click(buttons[3]);
    expect(onShiftAll).toHaveBeenCalledWith(500);
  });

  it('选中行提前/延后按钮在 hasSelection=false 时 disabled', () => {
    render(<LyricToolbar {...makeProps({ hasSelection: false })} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[4]).toBeDisabled();
    expect(buttons[5]).toBeDisabled();
  });

  it('选中行按钮在 hasSelection=true 时启用，点击触发 onShiftSelected', () => {
    const onShiftSelected = vi.fn();
    render(<LyricToolbar {...makeProps({ hasSelection: true, onShiftSelected })} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]);
    expect(onShiftSelected).toHaveBeenCalledWith(-500);
  });

  it('自定义步长输入：边界 1~99999 + 非数字 fallback 500', () => {
    const onCustomStepChange = vi.fn();
    render(<LyricToolbar {...makeProps({ onCustomStepChange })} />);
    const input = screen.getByLabelText('自定义步长') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '-10' } });
    expect(onCustomStepChange).toHaveBeenCalledWith(1);

    onCustomStepChange.mockClear();
    fireEvent.change(input, { target: { value: '200000' } });
    expect(onCustomStepChange).toHaveBeenCalledWith(99999);
  });

  it('撤销按钮在 hasHistory=false 时 disabled', () => {
    render(<LyricToolbar {...makeProps({ hasHistory: false })} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[9]).toBeDisabled();
  });

  it('撤销按钮在 hasHistory=true 时点击触发 onUndo', () => {
    const onUndo = vi.fn();
    render(<LyricToolbar {...makeProps({ hasHistory: true, onUndo })} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[9]);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  describe('文件 IO 组：右对齐 + 5 个按钮（源码/加载/保存/上传/下载）', () => {
    it('IO 组渲染于独立容器（data-testid=lyric-toolbar-io-group）且含 5 个按钮', () => {
      render(<LyricToolbar {...makeProps()} />);
      const ioGroup = screen.getByTestId('lyric-toolbar-io-group');
      expect(ioGroup).toBeInTheDocument();
      expect(within(ioGroup).getAllByRole('button')).toHaveLength(5);
    });

    it('IO 容器含 ml-auto class（确保右对齐不被未来重构误删）', () => {
      render(<LyricToolbar {...makeProps()} />);
      const ioGroup = screen.getByTestId('lyric-toolbar-io-group');
      expect(ioGroup.className).toContain('ml-auto');
    });

    it('点击源码/加载/保存/下载按钮触发对应回调', () => {
      const props = makeProps({ isAdmin: true });
      render(<LyricToolbar {...props} />);
      const ioButtons = within(screen.getByTestId('lyric-toolbar-io-group')).getAllByRole('button');
      // 顺序：源码 / 加载 / 保存 / 上传 / 下载
      fireEvent.click(ioButtons[0]);
      expect(props.onEditSource).toHaveBeenCalledTimes(1);
      fireEvent.click(ioButtons[1]);
      expect(props.onLoadFromFile).toHaveBeenCalledTimes(1);
      fireEvent.click(ioButtons[2]);
      expect(props.onSaveLocal).toHaveBeenCalledTimes(1);
      fireEvent.click(ioButtons[3]);
      expect(props.onUploadCloud).toHaveBeenCalledTimes(1);
      fireEvent.click(ioButtons[4]);
      expect(props.onDownloadLrc).toHaveBeenCalledTimes(1);
    });

    it('云上传按钮在 isAdmin=false 时 disabled', () => {
      render(<LyricToolbar {...makeProps({ isAdmin: false })} />);
      const ioButtons = within(screen.getByTestId('lyric-toolbar-io-group')).getAllByRole('button');
      // ioButtons[3] = 云上传（源码=0/加载=1/保存=2/上传=3/下载=4）
      expect(ioButtons[3]).toBeDisabled();
    });
  });
});
