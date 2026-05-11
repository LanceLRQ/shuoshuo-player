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

  it('Web 平台：渲染外观 / 水晶蟹小屋两个 tab，无缓存 tab', () => {
    renderAt('/settings');
    expect(screen.getByRole('tab', { name: /外观/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /水晶蟹小屋/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /缓存/ })).not.toBeInTheDocument();
  });

  it('Tauri 平台：额外渲染缓存 tab', () => {
    mockedDetect.mockReturnValue('tauri');
    renderAt('/settings');
    expect(screen.getByRole('tab', { name: /缓存/ })).toBeInTheDocument();
  });

  it('?tab=cloud → 水晶蟹小屋 tab 激活', () => {
    renderAt('/settings?tab=cloud');
    const cloudTab = screen.getByRole('tab', { name: /水晶蟹小屋/ });
    expect(cloudTab.getAttribute('data-state')).toBe('active');
  });

  it('未知 tab 参数 fallback 到外观', () => {
    renderAt('/settings?tab=invalid');
    const appearanceTab = screen.getByRole('tab', { name: /外观/ });
    expect(appearanceTab.getAttribute('data-state')).toBe('active');
  });
});
