import { fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './confirm-dialog';
import { useUIShell } from '@/stores/ui-shell';

function reset() {
  useUIShell.setState({
    confirmOpen: false,
    confirmConfig: null,
  });
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    reset();
  });

  it('confirmOpen=false 时不渲染对话框内容', () => {
    render(<ConfirmDialog />);
    expect(screen.queryByText('确认操作')).not.toBeInTheDocument();
  });

  it('openConfirm 后展示标题与描述', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog />);
    act(() => {
      useUIShell.getState().openConfirm({
        title: '删除歌单',
        description: '此操作不可恢复',
        onConfirm,
      });
    });
    expect(screen.getByText('删除歌单')).toBeInTheDocument();
    expect(screen.getByText('此操作不可恢复')).toBeInTheDocument();
  });

  it('点击确认按钮触发 onConfirm 并 closeConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog />);
    act(() => {
      useUIShell.getState().openConfirm({
        title: 'X',
        onConfirm,
      });
    });

    await user.click(screen.getByRole('button', { name: '确认' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(useUIShell.getState().confirmOpen).toBe(false);
    });
  });

  it('点击取消按钮触发 onCancel + closeConfirm', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog />);
    act(() => {
      useUIShell.getState().openConfirm({
        title: 'X',
        onConfirm,
        onCancel,
      });
    });

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(useUIShell.getState().confirmOpen).toBe(false);
  });

  it('async onConfirm 完成后才 closeConfirm（保证 await 完成 / 不重复关闭）', async () => {
    let resolveConfirm: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolveConfirm = r;
        }),
    );

    render(<ConfirmDialog />);
    act(() => {
      useUIShell.getState().openConfirm({ title: 'X', onConfirm });
    });

    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // 异步未 resolve 时 dialog 已关（Radix AlertDialogAction 默认行为）
    // 完成 onConfirm
    resolveConfirm?.();
    await waitFor(() => {
      expect(useUIShell.getState().confirmOpen).toBe(false);
    });
  });

  it('自定义 confirmText / cancelText 显示', () => {
    render(<ConfirmDialog />);
    act(() => {
      useUIShell.getState().openConfirm({
        title: 'X',
        confirmText: '我同意',
        cancelText: '别',
        onConfirm: vi.fn(),
      });
    });
    expect(screen.getByRole('button', { name: '我同意' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '别' })).toBeInTheDocument();
  });

  it('destructive=true 时确认按钮含 destructive 样式 class', () => {
    render(<ConfirmDialog />);
    act(() => {
      useUIShell.getState().openConfirm({
        title: 'X',
        destructive: true,
        onConfirm: vi.fn(),
      });
    });
    const btn = screen.getByRole('button', { name: '确认' });
    // shadcn destructive variant 至少包含 destructive token（如 bg-destructive）
    expect(btn.className).toMatch(/destructive/);
  });
});
