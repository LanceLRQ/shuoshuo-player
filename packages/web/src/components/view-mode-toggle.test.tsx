import { fireEvent, render, screen } from '@testing-library/react';
import { ViewModeToggle } from './view-mode-toggle';

describe('ViewModeToggle', () => {
  it('点击列表 / 缩略图按钮触发 onChange 对应枚举', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="thumbnail" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('列表视图'));
    expect(onChange).toHaveBeenCalledWith('list');

    fireEvent.click(screen.getByLabelText('缩略图视图'));
    expect(onChange).toHaveBeenCalledWith('thumbnail');
  });

  it('aria-pressed 随 value 切换', () => {
    const { rerender } = render(<ViewModeToggle value="list" onChange={vi.fn()} />);
    expect(screen.getByLabelText('列表视图')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('缩略图视图')).toHaveAttribute('aria-pressed', 'false');

    rerender(<ViewModeToggle value="thumbnail" onChange={vi.fn()} />);
    expect(screen.getByLabelText('列表视图')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('缩略图视图')).toHaveAttribute('aria-pressed', 'true');
  });
});
