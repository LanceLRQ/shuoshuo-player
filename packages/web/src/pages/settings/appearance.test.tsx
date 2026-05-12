import { fireEvent, render, screen } from '@testing-library/react';
import {
  usePlayerProfileStore,
  DEFAULT_FLOATING_LYRICS,
  DEFAULT_PRIMARY_COLOR,
} from '@shuoshuo-player/shared';
import { AppearanceSettings } from './appearance';

function reset() {
  usePlayerProfileStore.setState({
    theme: 'auto',
    primaryColor: DEFAULT_PRIMARY_COLOR,
    floatingLyrics: { ...DEFAULT_FLOATING_LYRICS },
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
    // 主色 Card 和悬浮歌词 Card 都有"恢复默认"按钮，按 DOM 顺序主色 Card 在前
    const resetButtons = screen.getAllByRole('button', { name: /恢复默认/ });
    fireEvent.click(resetButtons[0]);
    expect(usePlayerProfileStore.getState().primaryColor).toBe(DEFAULT_PRIMARY_COLOR);
  });

  describe('悬浮歌词 Card', () => {
    it('总开关 Switch 默认开启', () => {
      render(<AppearanceSettings />);
      const sw = screen.getByRole('switch', { name: /启用悬浮歌词/ }) as HTMLButtonElement;
      expect(sw.getAttribute('data-state')).toBe('checked');
    });

    it('点击总开关 → 翻转 floatingLyrics.enabled', () => {
      render(<AppearanceSettings />);
      const sw = screen.getByRole('switch', { name: /启用悬浮歌词/ }) as HTMLButtonElement;
      fireEvent.click(sw);
      expect(usePlayerProfileStore.getState().floatingLyrics.enabled).toBe(false);
      fireEvent.click(sw);
      expect(usePlayerProfileStore.getState().floatingLyrics.enabled).toBe(true);
    });

    it('字号 slider 变更 → setFloatingLyrics.fontSize', () => {
      render(<AppearanceSettings />);
      const slider = screen.getByLabelText(/字号/) as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '20' } });
      expect(usePlayerProfileStore.getState().floatingLyrics.fontSize).toBe(20);
    });

    it('点击字重 加粗 → setFloatingLyrics.fontWeight=bold', () => {
      render(<AppearanceSettings />);
      fireEvent.click(screen.getByRole('button', { name: /加粗/ }));
      expect(usePlayerProfileStore.getState().floatingLyrics.fontWeight).toBe('bold');
    });

    it('点击对齐 靠左 → setFloatingLyrics.textAlign=left', () => {
      render(<AppearanceSettings />);
      fireEvent.click(screen.getByRole('button', { name: '靠左' }));
      expect(usePlayerProfileStore.getState().floatingLyrics.textAlign).toBe('left');
    });

    it('恢复默认按钮在 default 状态下 disabled', () => {
      render(<AppearanceSettings />);
      const resetButtons = screen.getAllByRole('button', { name: /恢复默认/ });
      // 索引 1 = 悬浮歌词 Card 的恢复默认
      expect((resetButtons[1] as HTMLButtonElement).disabled).toBe(true);
    });

    it('调整后点恢复默认 → 重置 floatingLyrics 全部字段', () => {
      usePlayerProfileStore.setState({
        floatingLyrics: { ...DEFAULT_FLOATING_LYRICS, fontSize: 24, fontWeight: 'bold' },
      });
      render(<AppearanceSettings />);
      const resetButtons = screen.getAllByRole('button', { name: /恢复默认/ });
      fireEvent.click(resetButtons[1]);
      expect(usePlayerProfileStore.getState().floatingLyrics).toEqual(DEFAULT_FLOATING_LYRICS);
    });
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
