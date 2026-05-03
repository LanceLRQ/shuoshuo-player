import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useCloudServiceStore, useUIStore } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { CloudServicesLayout } from './layout';

function reset() {
  useCloudServiceStore.getState().clearSession();
  useUIStore.setState({ notices: [] });
  useUIShell.setState({ cloudLoginOpen: false });
}

const ADMIN_SESSION = {
  id: 1,
  token: 'tk',
  token_type: 'Bearer',
  expire_at: Date.now() / 1000 + 9999,
  account: {
    id: 1,
    user_name: 'admin',
    nick_name: 'A',
    avatar: '',
    role: 512, // Admin
  },
} as never;

const USER_SESSION = {
  ...ADMIN_SESSION,
  account: { ...ADMIN_SESSION.account, role: 1 },
} as never;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cloud-services/*" element={<CloudServicesLayout />}>
          <Route index element={<div data-testid="child-index" />} />
          <Route path="lyrics" element={<div data-testid="child-lyrics" />} />
          <Route path="settings" element={<div data-testid="child-settings" />} />
        </Route>
        <Route path="/index" element={<div data-testid="home" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CloudServicesLayout', () => {
  beforeEach(() => {
    reset();
  });

  it('未登录 → Navigate /index + 弹登录框 + 警告通知', async () => {
    renderAt('/cloud-services/lyrics');
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(useUIShell.getState().cloudLoginOpen).toBe(true);
    expect(useUIStore.getState().notices.length).toBeGreaterThan(0);
  });

  it('登录管理员 → 渲染 4 个 Tab + 子路由', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(ADMIN_SESSION);
    });
    renderAt('/cloud-services/lyrics');

    expect(screen.getByText('云服务管理')).toBeInTheDocument();
    expect(screen.getByText('管理员视图')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '歌词管理' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '切片管理' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '账户管理' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '服务设置' })).toBeInTheDocument();
    expect(screen.getByTestId('child-lyrics')).toBeInTheDocument();
  });

  it('登录普通用户 → 仅 settings tab 可见 + 标题"普通用户视图"', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(USER_SESSION);
    });
    renderAt('/cloud-services/settings');

    expect(screen.getByText('普通用户视图')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '歌词管理' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '服务设置' })).toBeInTheDocument();
  });

  it('普通用户访问 lyrics 子路径 → 重定向到 settings', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(USER_SESSION);
    });
    renderAt('/cloud-services/lyrics');

    // 重定向到 settings 后渲染 child-settings
    expect(screen.getByTestId('child-settings')).toBeInTheDocument();
  });
});
