import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { detectPlatformType, useCloudServiceStore, useUIStore } from '@shuoshuo-player/shared';
import { CloudSettingsPage } from './settings';

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

describe('CloudSettingsPage', () => {
  beforeEach(() => {
    resetStores();
    mockedDetect.mockReturnValue('web');
  });

  it('渲染默认地址 + 输入框 placeholder', () => {
    render(<CloudSettingsPage />);
    // 默认地址作为 code 块展示
    expect(screen.getByText('https://shuoshuo.sikong.ren/api')).toBeInTheDocument();
    // placeholder 与默认地址一致
    expect(screen.getByPlaceholderText('https://shuoshuo.sikong.ren/api')).toBeInTheDocument();
  });

  it('输入新值 + 保存 → setApiBaseUrl + 通知', async () => {
    render(<CloudSettingsPage />);
    const input = screen.getByLabelText('自定义地址') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'https://my.api/v3' } });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() => {
      expect(useCloudServiceStore.getState().apiBaseUrl).toBe('https://my.api/v3');
    });
    // 通知会进入 ui store notices
    expect(useUIStore.getState().notices.length).toBeGreaterThan(0);
  });

  it('保存按钮在 draft === apiBaseUrl 时 disabled（无变化）', () => {
    useCloudServiceStore.setState({ apiBaseUrl: 'https://my.api/v3' });
    render(<CloudSettingsPage />);
    const saveBtn = screen.getByRole('button', { name: /保存/ });
    expect(saveBtn).toBeDisabled();
  });

  it('恢复默认 → resetApiBaseUrl + draft 清空 + 通知', async () => {
    useCloudServiceStore.setState({ apiBaseUrl: 'https://my.api/v3' });
    render(<CloudSettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /恢复默认/ }));

    await waitFor(() => {
      expect(useCloudServiceStore.getState().apiBaseUrl).toBe('');
    });
    expect(useUIStore.getState().notices.length).toBeGreaterThan(0);
  });

  it('Tauri 平台：输入框 + 保存 + 重置全部 disabled，并显示警告 banner', () => {
    mockedDetect.mockReturnValue('tauri');
    render(<CloudSettingsPage />);

    const input = screen.getByLabelText('自定义地址') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /恢复默认/ })).toBeDisabled();

    // 警告文案：桌面端暂不支持
    expect(screen.getByText(/桌面端暂不支持/)).toBeInTheDocument();
  });

  it('store apiBaseUrl 外部变化时同步 draft（如其他页面调用 reset）', async () => {
    const { rerender } = render(<CloudSettingsPage />);
    const input = screen.getByLabelText('自定义地址') as HTMLInputElement;
    expect(input.value).toBe('');

    useCloudServiceStore.setState({ apiBaseUrl: 'https://outside.api' });
    rerender(<CloudSettingsPage />);

    await waitFor(() => {
      expect((screen.getByLabelText('自定义地址') as HTMLInputElement).value).toBe(
        'https://outside.api',
      );
    });
  });
});
