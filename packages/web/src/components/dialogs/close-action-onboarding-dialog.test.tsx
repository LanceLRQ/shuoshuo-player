import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_CLOSE_ACTION,
  DEFAULT_FLOATING_LYRICS,
  detectPlatformType,
  usePlayerProfileStore,
} from '@shuoshuo-player/shared';
import { CloseActionOnboardingDialog } from './close-action-onboarding-dialog';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    detectPlatformType: vi.fn(() => 'web'),
  };
});

const mockedDetect = vi.mocked(detectPlatformType);

function resetStore() {
  usePlayerProfileStore.setState({
    theme: 'auto',
    volume: 0.8,
    autoPlay: false,
    loopMode: 'loop',
    floatingLyrics: { ...DEFAULT_FLOATING_LYRICS },
    closeAction: DEFAULT_CLOSE_ACTION,
    closeActionFirstRunPrompted: false,
  });
}

describe('CloseActionOnboardingDialog', () => {
  beforeEach(() => {
    resetStore();
    mockedDetect.mockReturnValue('tauri');
  });

  it('非 Tauri 平台不渲染', () => {
    mockedDetect.mockReturnValue('web');
    render(<CloseActionOnboardingDialog />);
    expect(screen.queryByText('关闭窗口时，希望应用怎么处理？')).not.toBeInTheDocument();
  });

  it('Tauri 平台 + 已展示过引导：不渲染', () => {
    act(() => {
      usePlayerProfileStore.setState({ closeActionFirstRunPrompted: true });
    });
    render(<CloseActionOnboardingDialog />);
    expect(screen.queryByText('关闭窗口时，希望应用怎么处理？')).not.toBeInTheDocument();
  });

  it('Tauri 平台 + 未引导：渲染对话框且默认选 minimize-to-tray', () => {
    render(<CloseActionOnboardingDialog />);
    expect(screen.getByText('关闭窗口时，希望应用怎么处理？')).toBeInTheDocument();
    const trayRadio = screen.getByRole('radio', { name: /隐藏到托盘/ });
    expect(trayRadio.getAttribute('data-state')).toBe('checked');
  });

  it('切换到"直接退出"后点确定：写入 store + 翻转 prompted', async () => {
    const user = userEvent.setup();
    render(<CloseActionOnboardingDialog />);

    await user.click(screen.getByRole('radio', { name: /直接退出应用/ }));
    await user.click(screen.getByRole('button', { name: '就这么定了' }));

    expect(usePlayerProfileStore.getState().closeAction).toBe('exit');
    expect(usePlayerProfileStore.getState().closeActionFirstRunPrompted).toBe(true);
  });

  it('保持默认选项点确定：closeAction 维持 minimize-to-tray + prompted=true', async () => {
    const user = userEvent.setup();
    render(<CloseActionOnboardingDialog />);

    await user.click(screen.getByRole('button', { name: '就这么定了' }));

    expect(usePlayerProfileStore.getState().closeAction).toBe('minimize-to-tray');
    expect(usePlayerProfileStore.getState().closeActionFirstRunPrompted).toBe(true);
  });
});
