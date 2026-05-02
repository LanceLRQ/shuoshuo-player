import { AccountApi } from './account';
import { cloudPure } from '../client';

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

  it('Manage.lock 走 POST /accounts/:id/lock', async () => {
    await AccountApi.Manage.lock(123, 1700000000);
    const cfg = spy.mock.calls[0][0];
    expect(cfg.url).toBe('/accounts/123/lock');
    expect(cfg.method).toBe('post');
    expect(cfg.data).toEqual({ locked_until: 1700000000 });
  });

  it('Manage.unlock 走 POST /accounts/:id/unlock', async () => {
    await AccountApi.Manage.unlock(123);
    expect(spy.mock.calls[0][0].url).toBe('/accounts/123/unlock');
  });

  it('Manage.create 走 POST /accounts/', async () => {
    await AccountApi.Manage.create({
      email: 'x@y.com',
      user_name: 'xx',
      password: 'p',
      role: 1,
    });
    expect(spy.mock.calls[0][0].url).toBe('/accounts/');
    expect(spy.mock.calls[0][0].method).toBe('post');
  });
});
