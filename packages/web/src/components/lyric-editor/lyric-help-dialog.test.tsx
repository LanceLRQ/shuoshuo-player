import { fireEvent, render, screen } from '@testing-library/react';
import { LyricHelpDialog } from './lyric-help-dialog';

// Radix ScrollArea 依赖 ResizeObserver；jsdom 未实现，桩掉
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

describe('LyricHelpDialog', () => {
  it('默认仅渲染触发按钮，弹层内容未挂载', () => {
    render(<LyricHelpDialog />);
    expect(screen.getByRole('button', { name: '使用说明' })).toBeInTheDocument();
    expect(screen.queryByText('歌词编辑器使用说明')).not.toBeInTheDocument();
  });

  it('点击触发按钮后打开弹层，展示三大分区与关键说明', () => {
    render(<LyricHelpDialog />);
    fireEvent.click(screen.getByRole('button', { name: '使用说明' }));

    expect(screen.getByText('歌词编辑器使用说明')).toBeInTheDocument();
    expect(screen.getByText('鼠标操作')).toBeInTheDocument();
    expect(screen.getByText('工具栏功能')).toBeInTheDocument();
    expect(screen.getByText('小贴士')).toBeInTheDocument();
    // 关键交互说明在列（双击改时间 / 拖动框选）
    expect(screen.getByText(/改时间/)).toBeInTheDocument();
    expect(screen.getByText(/框选一段/)).toBeInTheDocument();
  });
});
