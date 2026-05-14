import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { detectPlatformType, setPlatformBridge } from '@shuoshuo-player/shared';
import { SettingsPage } from './index';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    detectPlatformType: vi.fn(() => 'web'),
  };
});

const mockedDetect = vi.mocked(detectPlatformType);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockedDetect.mockReturnValue('web');
    // 注入空 bridge（cache tab 不渲染但 cloud/appearance 仍能正常显示）
    setPlatformBridge({
      type: 'web',
      storage: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
      },
      auth: {
        login: async () => {},
        logout: async () => {},
        onLoginSuccess: () => () => {},
      },
      shell: { openExternal: async () => {} },
    });
  });

  it('Web 平台：仅渲染外观 / 关于两个 tab，无桌面端 / 水晶蟹小屋独立 tab', () => {
    renderAt('/settings');
    expect(screen.getByRole('tab', { name: /外观/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /关于/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /桌面端/ })).not.toBeInTheDocument();
    // 缓存已合并到桌面端，水晶蟹小屋已合并到关于页，均不应再作为独立 tab
    expect(screen.queryByRole('tab', { name: /缓存/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /水晶蟹小屋/ })).not.toBeInTheDocument();
  });

  it('Tauri 平台：额外渲染桌面端 tab；缓存与水晶蟹小屋仍不作为独立 tab 暴露', () => {
    mockedDetect.mockReturnValue('tauri');
    renderAt('/settings');
    expect(screen.getByRole('tab', { name: /桌面端/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /缓存/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /水晶蟹小屋/ })).not.toBeInTheDocument();
  });

  it('?tab=desktop 在非 Tauri 平台被重定向回 ?tab=appearance', () => {
    renderAt('/settings?tab=desktop');
    expect(screen.getByRole('tab', { name: /外观/ }).getAttribute('data-state')).toBe('active');
  });

  it('?tab=cache 兼容：Tauri 平台收敛到桌面端 tab', () => {
    mockedDetect.mockReturnValue('tauri');
    renderAt('/settings?tab=cache');
    expect(screen.getByRole('tab', { name: /桌面端/ }).getAttribute('data-state')).toBe('active');
  });

  it('?tab=cache 兼容：非 Tauri 平台回退到外观 tab', () => {
    renderAt('/settings?tab=cache');
    expect(screen.getByRole('tab', { name: /外观/ }).getAttribute('data-state')).toBe('active');
  });

  it('?tab=cloud 兼容：收敛到关于 tab', () => {
    renderAt('/settings?tab=cloud');
    expect(screen.getByRole('tab', { name: /关于/ }).getAttribute('data-state')).toBe('active');
  });

  it('未知 tab 参数 fallback 到外观', () => {
    renderAt('/settings?tab=invalid');
    const appearanceTab = screen.getByRole('tab', { name: /外观/ });
    expect(appearanceTab.getAttribute('data-state')).toBe('active');
  });
});
