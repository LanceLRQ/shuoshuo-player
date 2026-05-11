import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setPlatformBridge, MASTER_UP_INFO } from '@shuoshuo-player/shared';
import { BilibiliLoginRequired } from './bilibili-login-required';

describe('BilibiliLoginRequired', () => {
  const login = vi.fn(async () => {});
  const logout = vi.fn(async () => {});
  const onLoginSuccess = vi.fn(() => unsubscribe);
  const unsubscribe = vi.fn();
  const openExternal = vi.fn(async () => {});
  const reloadSpy = vi.fn();

  beforeEach(() => {
    login.mockReset();
    logout.mockReset();
    onLoginSuccess.mockReset();
    unsubscribe.mockReset();
    openExternal.mockReset();
    reloadSpy.mockReset();
    onLoginSuccess.mockImplementation(() => unsubscribe);

    // jsdom 默认 window.location.reload 抛 "not implemented"，覆写为 spy
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    setPlatformBridge({
      type: 'web',
      storage: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
      },
      auth: { login, logout, onLoginSuccess },
      shell: { openExternal },
    });
  });

  it('渲染含 v1 关键文案：UP 主名 + 投稿列表说明 + 隐私声明', () => {
    render(<BilibiliLoginRequired />);
    expect(screen.getByText('说说播放器')).toBeInTheDocument();
    expect(screen.getByText(`@${MASTER_UP_INFO.uname}`)).toBeInTheDocument();
    expect(
      screen.getByText(/的投稿列表需要登录B站，请先前往B站登录自己的账号/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/所有B站的数据的访问均由浏览器代为完成.*缓存均在本地完成.*请放心/),
    ).toBeInTheDocument();
  });

  it('点击「去B站」调 bridge.auth.login()', async () => {
    const user = userEvent.setup();
    render(<BilibiliLoginRequired />);
    await user.click(screen.getByRole('button', { name: /去B站/ }));
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('点击「刷新」调 window.location.reload()', async () => {
    const user = userEvent.setup();
    render(<BilibiliLoginRequired />);
    await user.click(screen.getByRole('button', { name: /刷新/ }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('点击 UP 主名链接：preventDefault + shell.openExternal 主页 URL', async () => {
    const user = userEvent.setup();
    render(<BilibiliLoginRequired />);
    await user.click(screen.getByText(`@${MASTER_UP_INFO.uname}`));
    expect(openExternal).toHaveBeenCalledWith(`https://space.bilibili.com/${MASTER_UP_INFO.mid}`);
  });

  it('mount 订阅 onLoginSuccess；unmount 调用返回的 unsubscribe', () => {
    const { unmount } = render(<BilibiliLoginRequired />);
    expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('登录成功事件触发后，回调内调用 reload', () => {
    render(<BilibiliLoginRequired />);
    const callback = onLoginSuccess.mock.calls[0]?.[0] as () => void;
    expect(callback).toBeDefined();

    callback();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
