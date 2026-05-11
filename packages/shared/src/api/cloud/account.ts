import { buildCloudApiCall } from '../client';
import type { CloudAccount, CloudServiceSession } from '../../types';

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
};
