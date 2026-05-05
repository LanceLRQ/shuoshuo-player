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
        </Route>
        <Route path="/index" element={<div data-testid="home" />} />
        <Route path="/settings" element={<div data-testid="global-settings" />} />
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

  it('登录管理员 → 渲染 3 个 Tab + 子路由（settings 已迁移到全局）', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(ADMIN_SESSION);
    });
    renderAt('/cloud-services/lyrics');

    expect(screen.getByText('云服务管理')).toBeInTheDocument();
    expect(screen.getByText('管理员视图')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '歌词管理' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '切片 UP 主' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '账户管理' })).toBeInTheDocument();
    // 服务设置 已迁到 /settings?tab=cloud
    expect(screen.queryByRole('tab', { name: '服务设置' })).not.toBeInTheDocument();
    expect(screen.getByTestId('child-lyrics')).toBeInTheDocument();
  });

  it('登录普通用户 → 重定向到全局 /settings?tab=cloud', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(USER_SESSION);
    });
    renderAt('/cloud-services/lyrics');

    expect(screen.getByTestId('global-settings')).toBeInTheDocument();
  });
});
