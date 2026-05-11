/**
 * useBilibiliUserStore 行为测试
 * 覆盖：getLoginUserInfo（成功 + 失败）、reset
 */
import { useBilibiliUserStore } from './bilibili-user';
import { UserApi, getWbiInfo } from '../api';

function reset() {
  useBilibiliUserStore.setState({
    isInited: false,
    isLogin: false,
    current: null,
  });
}

describe('useBilibiliUserStore', () => {
  beforeEach(() => {
    reset();
    vi.restoreAllMocks();
  });

  it('reset 重置全部字段', () => {
    useBilibiliUserStore.setState({
      isInited: true,
      isLogin: true,
      current: { mid: 1, uname: 'x' } as never,
    });
    useBilibiliUserStore.getState().reset();
    expect(useBilibiliUserStore.getState()).toMatchObject({
      isInited: false,
      isLogin: false,
      current: null,
    });
  });

  it('getLoginUserInfo 成功 + isLogin=true：写入 current 并提取 wbi', async () => {
    vi.spyOn(UserApi, 'getUserInfo').mockResolvedValue({
      mid: 1,
      uname: 'tester',
      isLogin: true,
      wbi_img: {
        img_url: 'https://example.com/abcdef0123456789.png',
        sub_url: 'https://example.com/9876543210fedcba.png',
      },
    } as never);

    await useBilibiliUserStore.getState().getLoginUserInfo();

    const state = useBilibiliUserStore.getState();
    expect(state.isInited).toBe(true);
    expect(state.isLogin).toBe(true);
    expect(state.current).toMatchObject({ mid: 1, uname: 'tester' });

    const wbi = getWbiInfo();
    expect(wbi).toBeTruthy();
    expect(wbi?.img_key).toBe('abcdef0123456789');
    expect(wbi?.sub_key).toBe('9876543210fedcba');
  });

  it('getLoginUserInfo 成功 + isLogin=false：current 保持 null，不更新 wbi', async () => {
    vi.spyOn(UserApi, 'getUserInfo').mockResolvedValue({
      isLogin: false,
    } as never);

    await useBilibiliUserStore.getState().getLoginUserInfo();

    const state = useBilibiliUserStore.getState();
    expect(state.isInited).toBe(true);
    expect(state.isLogin).toBe(false);
    expect(state.current).toBeNull();
  });

  it('getLoginUserInfo 抛错：状态退化为未登录但仍标记 isInited', async () => {
    vi.spyOn(UserApi, 'getUserInfo').mockRejectedValue(new Error('network'));

    await useBilibiliUserStore.getState().getLoginUserInfo();

    const state = useBilibiliUserStore.getState();
    expect(state.isInited).toBe(true);
    expect(state.isLogin).toBe(false);
    expect(state.current).toBeNull();
  });

  it('isLogin=true 但缺失 wbi_img 时不抛错', async () => {
    vi.spyOn(UserApi, 'getUserInfo').mockResolvedValue({
      mid: 9,
      isLogin: true,
    } as never);

    await expect(useBilibiliUserStore.getState().getLoginUserInfo()).resolves.toBeUndefined();
    expect(useBilibiliUserStore.getState().isLogin).toBe(true);
  });
});
