import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useCloudServiceStore } from '@shuoshuo-player/shared';
import { CloudServicesLayout } from './layout';

function reset() {
  useCloudServiceStore.getState().clearSession();
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
          <Route path="live-slicer-men" element={<div data-testid="child-slicer" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('CloudServicesLayout', () => {
  beforeEach(() => {
    reset();
  });

  it('未登录 → 不渲染 Tabs，直接渲染着陆页 outlet', () => {
    renderAt('/cloud-services');
    expect(screen.getByTestId('child-index')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '首页' })).not.toBeInTheDocument();
  });

  it('未登录访问子页面 → 仍渲染 layout 但 Tabs 隐藏（拦截下沉到子页面 RequireCloudAdmin）', () => {
    renderAt('/cloud-services/lyrics');
    expect(screen.getByTestId('child-lyrics')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '歌词管理' })).not.toBeInTheDocument();
  });

  it('管理员登录 → 渲染 3 个 Tab（首页 / 歌词管理 / 切片 UP 主），账户管理 / 服务设置 已下线', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(ADMIN_SESSION);
    });
    renderAt('/cloud-services/lyrics');

    expect(screen.getByRole('tab', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '歌词管理' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '切片 UP 主' })).toBeInTheDocument();
    // 账户管理已下线（不再走 v1 后端 /accounts/*）
    expect(screen.queryByRole('tab', { name: '账户管理' })).not.toBeInTheDocument();
    // 服务设置 已迁到 /settings?tab=cloud
    expect(screen.queryByRole('tab', { name: '服务设置' })).not.toBeInTheDocument();
    expect(screen.getByTestId('child-lyrics')).toBeInTheDocument();
  });

  it('普通用户登录 → 不渲染 Tabs（仅管理员可见），但 Outlet 继续渲染', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(USER_SESSION);
    });
    renderAt('/cloud-services/lyrics');
    expect(screen.getByTestId('child-lyrics')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '歌词管理' })).not.toBeInTheDocument();
  });
});
