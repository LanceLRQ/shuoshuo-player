import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  AccountApi,
  setPlatformBridge,
  resetPlatformBridge,
  useCloudServiceStore,
  useUIStore,
} from '@shuoshuo-player/shared';
import { CloudServicesIndexPage } from './index';

vi.mock('@shuoshuo-player/shared', async () => {
  const actual = await vi.importActual<object>('@shuoshuo-player/shared');
  return {
    ...actual,
    AccountApi: {
      login: vi.fn(),
    },
  };
});

const mockedLogin = vi.mocked(AccountApi.login);
const openExternalSpy = vi.fn(async () => {});

function reset() {
  useCloudServiceStore.getState().clearSession();
  useUIStore.setState({ notices: [] });
  mockedLogin.mockReset();
  openExternalSpy.mockClear();
}

beforeAll(() => {
  // BrandHeader 点击 logo 时通过 PlatformBridge.shell.openExternal 跳转官网，
  // 测试环境注入最小 bridge stub 避免触发"未初始化"错误
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
    shell: { openExternal: openExternalSpy },
  });
});
afterAll(() => resetPlatformBridge());

const ADMIN_SESSION = {
  id: 1,
  token: 'tk',
  token_type: 'Bearer',
  expire_at: Date.now() / 1000 + 9999,
  account: {
    id: 1,
    user_name: 'admin',
    nick_name: '小可',
    email: 'a@b.com',
    avatar: '',
    role: 512, // Admin
  },
} as never;

const USER_SESSION = {
  ...ADMIN_SESSION,
  account: { ...ADMIN_SESSION.account, role: 1 },
} as never;

function renderPage() {
  return render(
    <MemoryRouter>
      <CloudServicesIndexPage />
    </MemoryRouter>,
  );
}

describe('CloudServicesIndexPage', () => {
  beforeEach(reset);

  it('未登录 → 渲染品牌头 + 登录卡（含邮箱/密码字段）', () => {
    renderPage();
    expect(screen.getByText('水晶蟹小屋')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('空字段提交触发 zod 校验错误', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => {
      expect(screen.getByText('请输入邮箱')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('邮箱格式不正确：login 不触发', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'not-email' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pwd' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('登录成功 → updateSession + 切换为欢迎卡（含管理员快捷入口）', async () => {
    mockedLogin.mockResolvedValueOnce(ADMIN_SESSION);
    renderPage();

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'p' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(useCloudServiceStore.getState().session.token).toBe('tk');
    });
    expect(await screen.findByText('欢迎回来')).toBeInTheDocument();
    expect(screen.getByText('小可')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /进入歌词管理/ })).toHaveAttribute(
      'href',
      '/cloud-services/lyrics',
    );
    expect(screen.getByRole('link', { name: /进入切片 UP 主管理/ })).toHaveAttribute(
      'href',
      '/cloud-services/live-slicer-men',
    );
    const success = useUIStore.getState().notices.find((n) => /欢迎回来/.test(n.message));
    expect(success).toBeDefined();
  });

  it('登录失败 → 错误通知 + 仍停留在登录卡', async () => {
    mockedLogin.mockRejectedValueOnce(new Error('密码错误'));
    renderPage();

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      const err = useUIStore.getState().notices.find((n) => /密码错误/.test(n.message));
      expect(err).toBeDefined();
    });
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
  });

  it('普通用户已登录 → 欢迎卡仅显示退出登录，无管理快捷入口与权限提示', () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(USER_SESSION);
    });
    renderPage();
    expect(screen.getByText('欢迎回来')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /进入歌词管理/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /进入切片 UP 主管理/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/无管理员权限/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /退出登录/ })).toBeInTheDocument();
  });

  it('已登录点击退出 → 调用 clearSession + 切换回登录卡', async () => {
    act(() => {
      useCloudServiceStore.getState().updateSession(ADMIN_SESSION);
    });
    renderPage();
    expect(screen.getByText('欢迎回来')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /退出登录/ }));
    await waitFor(() => {
      expect(useCloudServiceStore.getState().isLogin()).toBe(false);
    });
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
  });

  it('点击品牌头（logo + 名称）→ bridge.shell.openExternal 跳转官网', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '访问水晶蟹小屋官网' }));
    expect(openExternalSpy).toHaveBeenCalledWith('https://shuoshuo.sikong.ren');
  });
});
