import { triggerWbiRefresh } from './wbi-refresh';
import { useBilibiliUserStore } from '../store/bilibili-user';

describe('triggerWbiRefresh', () => {
  // 模块内 lastRefreshAt 单例：用 force=true 跳过 20 分钟阈值，确保每个用例都能实际触发
  it('调用 useBilibiliUserStore.getLoginUserInfo()', async () => {
    const spy = vi.fn(async () => {});
    const original = useBilibiliUserStore.getState().getLoginUserInfo;
    useBilibiliUserStore.setState({ getLoginUserInfo: spy });

    await triggerWbiRefresh(true);
    expect(spy).toHaveBeenCalledTimes(1);

    useBilibiliUserStore.setState({ getLoginUserInfo: original });
  });

  it('返回 Promise，等待 store action 完成（避免 fire-and-forget）', async () => {
    let resolved = false;
    const original = useBilibiliUserStore.getState().getLoginUserInfo;
    useBilibiliUserStore.setState({
      getLoginUserInfo: async () => {
        await new Promise((r) => setTimeout(r, 5));
        resolved = true;
      },
    });

    await triggerWbiRefresh(true);
    expect(resolved).toBe(true);

    useBilibiliUserStore.setState({ getLoginUserInfo: original });
  });

  it('20 分钟内重复调用：跳过实际请求（节流）', async () => {
    const spy = vi.fn(async () => {});
    const original = useBilibiliUserStore.getState().getLoginUserInfo;
    useBilibiliUserStore.setState({ getLoginUserInfo: spy });

    // 第一次（force）触发
    await triggerWbiRefresh(true);
    expect(spy).toHaveBeenCalledTimes(1);

    // 紧随第二次（非 force）：lastRefreshAt 未过 20min，应跳过
    await triggerWbiRefresh();
    expect(spy).toHaveBeenCalledTimes(1);

    useBilibiliUserStore.setState({ getLoginUserInfo: original });
  });
});
