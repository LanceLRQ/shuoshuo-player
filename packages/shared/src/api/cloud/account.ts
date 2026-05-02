import { buildCloudApiCall } from '../client';
import type { CloudAccount, CloudListResponse, CloudServiceSession } from '../../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateSelfPayload {
  email?: string;
  user_name?: string;
  nick_name?: string;
  avatar?: string;
  /** 修改密码时必填（除非账户尚未设置密码） */
  old_password?: string;
  /** 新密码（与 old_password 同时提交） */
  password?: string;
}

export interface CheckLoginResponse {
  login: boolean;
  account_id?: number;
  account?: CloudAccount;
  website_settings?: {
    player_publish?: Record<string, string>;
    duet_banner?: string;
    current_duet_id?: number;
    current_duet_name?: string;
    mailbox?: {
      open: boolean;
      allow_images: boolean;
      max_images: number;
      allow_voice: boolean;
      max_voice_duration: number;
    };
  };
}

export interface CreateAccountPayload {
  email: string;
  user_name: string;
  nick_name?: string;
  password: string;
  /** 1 / 512 / 1024 */
  role: number;
}

export interface UpdateAccountPayload {
  email?: string;
  user_name?: string;
  nick_name?: string;
  avatar?: string;
  role?: number;
  /** 管理员强制重置时使用 */
  password?: string;
}

export interface AccountListParams {
  page?: number;
  limit?: number;
  keyword?: string;
}

export const AccountApi = {
  /** 登录（JSON 模式） */
  login: (data: LoginPayload) =>
    buildCloudApiCall<CloudServiceSession>({ url: '/login', method: 'post' })({
      data: data as unknown as Record<string, unknown>,
    }),

  /** 检查登录状态 + 获取 website_settings */
  checkLogin: () => buildCloudApiCall<CheckLoginResponse>({ url: '/login' })(),

  /** 当前用户信息 */
  getSelf: () => buildCloudApiCall<CloudAccount>({ url: '/accounts/self' })(),

  /** 修改当前用户信息（含修改密码） */
  updateSelf: (data: UpdateSelfPayload) =>
    buildCloudApiCall<CloudAccount>({ url: '/accounts/self', method: 'put' })({
      data: data as Record<string, unknown>,
    }),

  /** QQ 互联头像 */
  getQQConnectAvatar: () =>
    buildCloudApiCall<{ avatar: string }>({ url: '/accounts/self/qqconn_avatar' })(),

  /** 管理员接口 */
  Manage: {
    list: (params?: AccountListParams) =>
      buildCloudApiCall<CloudListResponse<CloudAccount>>({ url: '/accounts/list' })({ params }),

    get: (id: number) => buildCloudApiCall<CloudAccount>({ url: `/accounts/${id}` })(),

    create: (data: CreateAccountPayload) =>
      buildCloudApiCall<CloudAccount>({ url: '/accounts/', method: 'post' })({
        data: data as unknown as Record<string, unknown>,
      }),

    update: (id: number, data: UpdateAccountPayload) =>
      buildCloudApiCall<CloudAccount>({ url: `/accounts/${id}`, method: 'put' })({
        data: data as Record<string, unknown>,
      }),

    delete: (id: number) =>
      buildCloudApiCall<{ id: number; result: string }>({
        url: `/accounts/${id}`,
        method: 'delete',
      })(),

    /** 封禁账户（locked = Unix 时间戳秒） */
    lock: (id: number, lockedUntilUnixSec?: number) =>
      buildCloudApiCall<CloudAccount>({ url: `/accounts/${id}/lock`, method: 'post' })({
        data: { locked_until: lockedUntilUnixSec },
      }),

    /** 解除封禁 */
    unlock: (id: number) =>
      buildCloudApiCall<CloudAccount>({ url: `/accounts/${id}/unlock`, method: 'post' })(),
  },
};
