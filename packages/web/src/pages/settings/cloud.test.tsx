import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { detectPlatformType, useCloudServiceStore, useUIStore } from '@shuoshuo-player/shared';
import { CloudSettings } from './cloud';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    detectPlatformType: vi.fn(() => 'web'),
  };
});

const mockedDetect = vi.mocked(detectPlatformType);

function resetStores() {
  useCloudServiceStore.setState({ apiBaseUrl: '' });
  useUIStore.setState({ notices: [] });
}

describe('CloudSettings', () => {
  beforeEach(() => {
    resetStores();
    mockedDetect.mockReturnValue('web');
  });

  it('渲染默认地址 + 输入框 placeholder', () => {
    render(<CloudSettings />);
    expect(screen.getByText('https://shuoshuo.sikong.ren/api')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://shuoshuo.sikong.ren/api')).toBeInTheDocument();
  });

  it('输入新值 + 保存 → setApiBaseUrl + 通知', async () => {
    render(<CloudSettings />);
    const input = screen.getByLabelText('自定义地址') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'https://my.api/v3' } });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() => {
      expect(useCloudServiceStore.getState().apiBaseUrl).toBe('https://my.api/v3');
    });
    expect(useUIStore.getState().notices.length).toBeGreaterThan(0);
  });

  it('Tauri 平台 → 输入框禁用 + 警示文案', () => {
    mockedDetect.mockReturnValue('tauri');
    render(<CloudSettings />);
    const input = screen.getByLabelText('自定义地址') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.getByText(/桌面端水晶蟹小屋地址固定/)).toBeInTheDocument();
  });

  it('恢复默认按钮 → 清空 store + draft', async () => {
    useCloudServiceStore.setState({ apiBaseUrl: 'https://my.api/v3' });
    render(<CloudSettings />);
    fireEvent.click(screen.getByRole('button', { name: /恢复默认/ }));
    await waitFor(() => {
      expect(useCloudServiceStore.getState().apiBaseUrl).toBe('');
    });
  });
});
