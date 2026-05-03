import { triggerWbiRefresh } from './wbi-refresh';
import { useBilibiliUserStore } from '../store/bilibili-user';

describe('triggerWbiRefresh', () => {
  it('调用 useBilibiliUserStore.getLoginUserInfo()', async () => {
    const spy = vi.fn(async () => {});
    const original = useBilibiliUserStore.getState().getLoginUserInfo;
    useBilibiliUserStore.setState({ getLoginUserInfo: spy });

    await triggerWbiRefresh();
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

    await triggerWbiRefresh();
    expect(resolved).toBe(true);

    useBilibiliUserStore.setState({ getLoginUserInfo: original });
  });
});
