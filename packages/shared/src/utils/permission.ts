import { CloudServiceUserRole } from '../types';

/** 检查云服务用户权限（位与运算） */
export function checkCloudUserPermission(
  account: { role: CloudServiceUserRole | number } | undefined,
  roleRequire: CloudServiceUserRole | number,
): boolean {
  if (!account) return false;
  return (Number(account.role) & roleRequire) === roleRequire;
}
