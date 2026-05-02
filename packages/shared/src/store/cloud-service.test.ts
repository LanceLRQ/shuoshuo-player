import { useCloudServiceStore } from './cloud-service';
import { getCloudApiBaseUrl } from '../api';
import { DEFAULT_CLOUD_API_BASE_URL, CloudServiceUserRole } from '../index';

const initial = useCloudServiceStore.getState();

beforeEach(() => {
  // 每个用例前重置为初始 state（不会破坏订阅）
  useCloudServiceStore.setState(initial, true);
});

describe('C1: cloud-service store', () => {
  it('initial state：未登录、apiBaseUrl 为空', () => {
    const s = useCloudServiceStore.getState();
    expect(s.session.token).toBe('');
    expect(s.session.account.id).toBe(0);
    expect(s.apiBaseUrl).toBe('');
    expect(s.isLogin()).toBe(false);
  });

  it('updateSession 合并 account 字段而非整体替换', () => {
    useCloudServiceStore.getState().updateSession({
      token: 't1',
      expire_at: Math.floor(Date.now() / 1000) + 3600,
      account: { id: 1, user_name: 'alice' } as never,
    });
    const s = useCloudServiceStore.getState();
    expect(s.session.token).toBe('t1');
    expect(s.session.account.id).toBe(1);
    expect(s.session.account.user_name).toBe('alice');
    expect(s.session.account.role).toBe(CloudServiceUserRole.User); // 默认值未被覆盖
    expect(s.isLogin()).toBe(true);
  });

  it('clearSession 重置 session 与 token', () => {
    useCloudServiceStore.getState().updateSession({
      token: 't1',
      expire_at: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(useCloudServiceStore.getState().isLogin()).toBe(true);

    useCloudServiceStore.getState().clearSession();
    const s = useCloudServiceStore.getState();
    expect(s.session.token).toBe('');
    expect(s.session.account.id).toBe(0);
    expect(s.isLogin()).toBe(false);
  });

  it('expire_at 已过期视为未登录', () => {
    useCloudServiceStore.getState().updateSession({
      token: 't1',
      expire_at: Math.floor(Date.now() / 1000) - 10,
    });
    expect(useCloudServiceStore.getState().isLogin()).toBe(false);
  });

  it('setApiBaseUrl 自定义值立即生效（store + client）', () => {
    useCloudServiceStore.getState().setApiBaseUrl('https://custom.example.com/api');
    expect(useCloudServiceStore.getState().apiBaseUrl).toBe('https://custom.example.com/api');
    expect(getCloudApiBaseUrl()).toBe('https://custom.example.com/api');
  });

  it('setApiBaseUrl 空字符串 / 仅空格 → fallback 默认', () => {
    useCloudServiceStore.getState().setApiBaseUrl('   ');
    expect(useCloudServiceStore.getState().apiBaseUrl).toBe('');
    expect(getCloudApiBaseUrl()).toBe(DEFAULT_CLOUD_API_BASE_URL);
  });

  it('resetApiBaseUrl 清空 store 字段并恢复默认', () => {
    useCloudServiceStore.getState().setApiBaseUrl('https://custom.example.com/api');
    useCloudServiceStore.getState().resetApiBaseUrl();
    expect(useCloudServiceStore.getState().apiBaseUrl).toBe('');
    expect(getCloudApiBaseUrl()).toBe(DEFAULT_CLOUD_API_BASE_URL);
  });

  it('isAdmin: User=false / Admin=true / WebMaster=true / Admin|WebMaster=true', () => {
    const cases: Array<[number, boolean]> = [
      [CloudServiceUserRole.User, false],
      [CloudServiceUserRole.Admin, true],
      [CloudServiceUserRole.WebMaster, true],
      [CloudServiceUserRole.Admin | CloudServiceUserRole.WebMaster, true],
      [0, false],
    ];
    for (const [role, expected] of cases) {
      useCloudServiceStore.setState(initial, true);
      useCloudServiceStore.getState().updateSession({
        account: { id: 1, role } as never,
      });
      expect(useCloudServiceStore.getState().isAdmin()).toBe(expected);
    }
  });

  it('roleName 映射：User → 水晶蟹 / Admin → 管理员 / WebMaster → 站长', () => {
    useCloudServiceStore.getState().updateSession({
      account: { id: 1, role: CloudServiceUserRole.User } as never,
    });
    expect(useCloudServiceStore.getState().roleName()).toBe('水晶蟹');

    useCloudServiceStore.getState().updateSession({
      account: { id: 1, role: CloudServiceUserRole.Admin } as never,
    });
    expect(useCloudServiceStore.getState().roleName()).toBe('管理员');

    useCloudServiceStore.getState().updateSession({
      account: { id: 1, role: CloudServiceUserRole.WebMaster } as never,
    });
    expect(useCloudServiceStore.getState().roleName()).toBe('站长');
  });
});
