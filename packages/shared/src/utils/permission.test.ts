import { checkCloudUserPermission } from './permission';
import { CloudServiceUserRole } from '../types';

const ADMIN = CloudServiceUserRole.Admin; // 512
const MASTER = CloudServiceUserRole.WebMaster; // 1024
const USER = CloudServiceUserRole.User; // 1

describe('A3: checkCloudUserPermission 位运算', () => {
  it.each([
    { role: 0, require: USER, expected: false },
    { role: USER, require: USER, expected: true },
    { role: ADMIN, require: ADMIN, expected: true },
    { role: ADMIN, require: MASTER, expected: false },
    { role: MASTER, require: ADMIN, expected: false },
    { role: ADMIN | MASTER, require: ADMIN, expected: true },
    { role: ADMIN | MASTER, require: MASTER, expected: true },
    { role: ADMIN | USER, require: USER, expected: true },
    { role: ADMIN | USER, require: ADMIN, expected: true },
    { role: ADMIN | MASTER, require: USER, expected: false },
  ])('role=$role require=$require → $expected', ({ role, require, expected }) => {
    expect(checkCloudUserPermission({ role }, require)).toBe(expected);
  });

  it('account 为 undefined 时返回 false', () => {
    expect(checkCloudUserPermission(undefined, USER)).toBe(false);
  });

  it('role 字符串数字也能正确按位运算', () => {
    expect(checkCloudUserPermission({ role: '512' as unknown as number }, ADMIN)).toBe(true);
  });
});
