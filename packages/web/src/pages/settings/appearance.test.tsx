import { fireEvent, render, screen } from '@testing-library/react';
import { usePlayerProfileStore, DEFAULT_PRIMARY_COLOR } from '@shuoshuo-player/shared';
import { AppearanceSettings } from './appearance';

function reset() {
  usePlayerProfileStore.setState({
    theme: 'auto',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  });
}

describe('AppearanceSettings', () => {
  beforeEach(() => {
    reset();
  });

  it('渲染三个主题按钮 + 默认主色', () => {
    render(<AppearanceSettings />);
    expect(screen.getByRole('button', { name: /亮色/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /暗色/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /跟随系统/ })).toBeInTheDocument();
    // 当前主色字符串显示在 code 块
    expect(screen.getByText(DEFAULT_PRIMARY_COLOR)).toBeInTheDocument();
  });

  it('点击主题按钮切换 store.theme', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('button', { name: /暗色/ }));
    expect(usePlayerProfileStore.getState().theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: /亮色/ }));
    expect(usePlayerProfileStore.getState().theme).toBe('light');
  });

  it('点击预设色 → setPrimaryColor', () => {
    render(<AppearanceSettings />);
    // 玫粉预设
    fireEvent.click(screen.getByRole('button', { name: /玫粉/ }));
    expect(usePlayerProfileStore.getState().primaryColor).toBe('346 77% 49%');
  });

  it('色相 slider 改 hue 后保留 saturation/lightness', () => {
    usePlayerProfileStore.setState({ primaryColor: '120 50% 40%' });
    render(<AppearanceSettings />);
    const slider = screen.getByLabelText(/色相微调/) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '200' } });
    expect(usePlayerProfileStore.getState().primaryColor).toBe('200 50% 40%');
  });

  it('恢复默认按钮 → 重置主色', () => {
    usePlayerProfileStore.setState({ primaryColor: '100 50% 50%' });
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('button', { name: /恢复默认/ }));
    expect(usePlayerProfileStore.getState().primaryColor).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it('autoPlayNextPage toggle 默认关闭，点击后开启 store 字段（D4）', () => {
    usePlayerProfileStore.setState({ autoPlayNextPage: false });
    render(<AppearanceSettings />);
    const sw = screen.getByRole('switch', { name: /多 P 投稿连续播放/ }) as HTMLButtonElement;
    expect(sw.getAttribute('data-state')).toBe('unchecked');
    fireEvent.click(sw);
    expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(true);
    fireEvent.click(sw);
    expect(usePlayerProfileStore.getState().autoPlayNextPage).toBe(false);
  });
});
