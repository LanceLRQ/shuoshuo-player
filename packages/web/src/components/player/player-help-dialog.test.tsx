import { fireEvent, render, screen } from '@testing-library/react';
import { PlayerHelpDialog } from './player-help-dialog';

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

describe('PlayerHelpDialog', () => {
  it('默认仅渲染触发按钮，弹层内容未挂载', () => {
    render(<PlayerHelpDialog />);
    expect(screen.getByRole('button', { name: '使用帮助' })).toBeInTheDocument();
    expect(screen.queryByText('播放器使用帮助')).not.toBeInTheDocument();
  });

  it('点击触发按钮后打开弹层，展示各分区与关键操作', () => {
    render(<PlayerHelpDialog />);
    fireEvent.click(screen.getByRole('button', { name: '使用帮助' }));

    expect(screen.getByText('播放器使用帮助')).toBeInTheDocument();
    expect(screen.getByText('播放控制')).toBeInTheDocument();
    expect(screen.getByText('歌词与音质')).toBeInTheDocument();
    expect(screen.getByText('更多操作')).toBeInTheDocument();
    // 关键操作在列（播完就停 / 播放列表）
    expect(screen.getByText('播完就停')).toBeInTheDocument();
    expect(screen.getByText('播放列表')).toBeInTheDocument();
  });
});
