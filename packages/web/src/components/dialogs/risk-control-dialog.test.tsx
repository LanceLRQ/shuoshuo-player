import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RiskControlDialog } from './risk-control-dialog';
import {
  useRiskControlStore,
  usePlayingListStore,
  setPlatformBridge,
} from '@shuoshuo-player/shared';

function reset() {
  useRiskControlStore.setState({ open: false, voucher: null, bvid: null });
  usePlayingListStore.setState({ playNext: false });
}

describe('RiskControlDialog', () => {
  const openExternal = vi.fn(async () => {});

  beforeEach(() => {
    reset();
    openExternal.mockReset();
    // 注入最小 platform bridge：仅 dialog 用到 shell.openExternal
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
      shell: { openExternal },
    });
  });

  it('open=false 时不渲染对话框内容', () => {
    render(<RiskControlDialog />);
    expect(screen.queryByText('B 站接口被风控')).not.toBeInTheDocument();
  });

  it('openRiskControl 后展示标题、步骤、voucher 摘要', () => {
    render(<RiskControlDialog />);
    act(() => {
      useRiskControlStore.getState().openRiskControl('voucher_abcdefg_xxxxxxxx', 'BV1ShowMe');
    });
    expect(screen.getByText('B 站接口被风控')).toBeInTheDocument();
    expect(screen.getByText(/voucher: voucher_abcdefg_xxxxxxxx/)).toBeInTheDocument();
  });

  it('点击「去 B 站主站验证」打开当前 bvid 视频页', async () => {
    const user = userEvent.setup();
    render(<RiskControlDialog />);
    act(() => {
      useRiskControlStore.getState().openRiskControl('v', 'BV1Target');
    });

    await user.click(screen.getByRole('button', { name: '去 B 站主站验证' }));
    expect(openExternal).toHaveBeenCalledWith('https://www.bilibili.com/video/BV1Target/');
  });

  it('无 bvid 时主站按钮兜底打开首页', async () => {
    const user = userEvent.setup();
    render(<RiskControlDialog />);
    act(() => {
      // bvid 为空字符串模拟边界
      useRiskControlStore.setState({ open: true, voucher: 'v', bvid: '' });
    });

    await user.click(screen.getByRole('button', { name: '去 B 站主站验证' }));
    expect(openExternal).toHaveBeenCalledWith('https://www.bilibili.com/');
  });

  it('点击「已完成验证，重试」：触发 playNext + 关闭对话框', async () => {
    const user = userEvent.setup();
    render(<RiskControlDialog />);
    act(() => {
      useRiskControlStore.getState().openRiskControl('v', 'BV1Retry');
    });

    await user.click(screen.getByRole('button', { name: '已完成验证，重试' }));

    expect(usePlayingListStore.getState().playNext).toBe(true);
    await waitFor(() => {
      expect(useRiskControlStore.getState().open).toBe(false);
    });
  });

  it('点击「关闭」按钮：仅关闭对话框，不触发 playNext', async () => {
    const user = userEvent.setup();
    render(<RiskControlDialog />);
    act(() => {
      useRiskControlStore.getState().openRiskControl('v', 'BV1Close');
    });

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(usePlayingListStore.getState().playNext).toBe(false);
    await waitFor(() => {
      expect(useRiskControlStore.getState().open).toBe(false);
    });
  });
});
