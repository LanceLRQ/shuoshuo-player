import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { AccountApi, useCloudServiceStore, useUIStore } from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { CloudLoginDialog } from './cloud-login-dialog';

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

function reset() {
  useUIShell.setState({ cloudLoginOpen: false });
  useCloudServiceStore.getState().clearSession();
  useUIStore.setState({ notices: [] });
  mockedLogin.mockReset();
}

describe('CloudLoginDialog', () => {
  beforeEach(() => {
    reset();
  });

  it('cloudLoginOpen=false 时不渲染', () => {
    render(<CloudLoginDialog />);
    expect(screen.queryByText('云服务登录')).not.toBeInTheDocument();
  });

  it('打开时显示标题 + 邮箱/密码字段', () => {
    render(<CloudLoginDialog />);
    act(() => useUIShell.getState().openCloudLogin());

    expect(screen.getByText('云服务登录')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
  });

  it('空字段提交触发 zod 校验错误', async () => {
    render(<CloudLoginDialog />);
    act(() => useUIShell.getState().openCloudLogin());

    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('邮箱格式不正确：login 不触发（zod 校验拦截）', async () => {
    render(<CloudLoginDialog />);
    act(() => useUIShell.getState().openCloudLogin());

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pwd' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    // zod email() 失败 → handleSubmit 不调 onSubmit → AccountApi.login 不被调
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedLogin).not.toHaveBeenCalled();
    // 对话框保持打开（未关闭）
    expect(useUIShell.getState().cloudLoginOpen).toBe(true);
  });

  it('登录成功 → updateSession + 成功通知 + 关闭对话框', async () => {
    const session = {
      id: 1,
      token: 'tk',
      token_type: 'Bearer',
      expire_at: Date.now() / 1000 + 9999,
      account: { id: 1, user_name: 'u', nick_name: '小可', avatar: '', role: 1 },
    };
    mockedLogin.mockResolvedValueOnce(session as never);

    render(<CloudLoginDialog />);
    act(() => useUIShell.getState().openCloudLogin());

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'p' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(useCloudServiceStore.getState().session.token).toBe('tk');
    });
    expect(useUIShell.getState().cloudLoginOpen).toBe(false);
    const success = useUIStore.getState().notices.find((n) => /欢迎回来/.test(n.message));
    expect(success).toBeDefined();
  });

  it('登录失败 → 错误通知 + 不关闭对话框', async () => {
    mockedLogin.mockRejectedValueOnce(new Error('密码错误'));

    render(<CloudLoginDialog />);
    act(() => useUIShell.getState().openCloudLogin());

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      const errorNotice = useUIStore.getState().notices.find((n) => /密码错误/.test(n.message));
      expect(errorNotice).toBeDefined();
    });
    expect(useUIShell.getState().cloudLoginOpen).toBe(true);
  });

  it('点击取消按钮关闭对话框', async () => {
    render(<CloudLoginDialog />);
    act(() => useUIShell.getState().openCloudLogin());

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => {
      expect(useUIShell.getState().cloudLoginOpen).toBe(false);
    });
  });
});
