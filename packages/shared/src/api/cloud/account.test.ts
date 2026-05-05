import { AccountApi } from './account';
import { cloudPure } from '../client';

/**
 * B4: 云服务 AccountApi 关键端点（仅自身用户能力）
 *
 * v2 已下线 v1 的 /accounts/list / /accounts/:id / lock/unlock 等管理端点；
 * 本套测试只覆盖每个用户都需要的会话 / 自身信息接口。
 */
describe('B4: 云服务 AccountApi 关键端点', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(cloudPure, 'request').mockResolvedValue({
      data: { code: 0, data: { id: 1, user_name: 'x' } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updateSelf 走 PUT /accounts/self 并能携带 old_password+password', async () => {
    await AccountApi.updateSelf({ old_password: 'old', password: 'new' });
    const cfg = spy.mock.calls[0][0];
    expect(cfg.url).toBe('/accounts/self');
    expect(cfg.method).toBe('put');
    expect(cfg.data).toMatchObject({ old_password: 'old', password: 'new' });
  });

  it('login 走 POST /login', async () => {
    await AccountApi.login({ email: 'a@b.com', password: 'p' });
    expect(spy.mock.calls[0][0].url).toBe('/login');
    expect(spy.mock.calls[0][0].method).toBe('post');
  });

  it('checkLogin 走 GET /login', async () => {
    await AccountApi.checkLogin();
    expect(spy.mock.calls[0][0].url).toBe('/login');
    // method 默认 get
    expect(spy.mock.calls[0][0].method ?? 'get').toBe('get');
  });

  it('getSelf 走 GET /accounts/self', async () => {
    await AccountApi.getSelf();
    expect(spy.mock.calls[0][0].url).toBe('/accounts/self');
  });

  it('getQQConnectAvatar 走 GET /accounts/self/qqconn_avatar', async () => {
    await AccountApi.getQQConnectAvatar();
    expect(spy.mock.calls[0][0].url).toBe('/accounts/self/qqconn_avatar');
  });

  it('AccountApi 不再暴露 Manage 子对象', () => {
    expect((AccountApi as unknown as { Manage?: unknown }).Manage).toBeUndefined();
  });
});
