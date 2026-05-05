import { create } from 'zustand';
import { CloudServiceUserRole, type CloudServiceSession, type CloudAccount } from '../types';
import { CLOUD_SERVICE_ROLE_NAME_MAP, DEFAULT_CLOUD_API_BASE_URL } from '../constants';
import { setCloudServiceToken, setCloudApiBaseUrl, setSessionExpiredHandler } from '../api';

const DEFAULT_ACCOUNT: CloudAccount = {
  id: 0,
  user_name: '',
  nick_name: '',
  email: '',
  avatar: '',
  role: CloudServiceUserRole.User,
  created_at: 0,
  updated_at: 0,
};

const DEFAULT_SESSION: CloudServiceSession = {
  id: 0,
  token: '',
  token_type: 'Bearer',
  expire_at: 0,
  account: { ...DEFAULT_ACCOUNT },
};

interface CloudServiceState {
  session: CloudServiceSession;
  /** 用户自定义 baseURL（空字符串表示使用默认值） */
  apiBaseUrl: string;

  updateSession: (session: Partial<CloudServiceSession>) => void;
  clearSession: () => void;
  setApiBaseUrl: (url: string) => void;
  resetApiBaseUrl: () => void;

  isLogin: () => boolean;
  roleName: () => string;
  /** 位与运算：(role & (Admin | WebMaster)) !== 0 */
  isAdmin: () => boolean;
}

export const useCloudServiceStore = create<CloudServiceState>((set, get) => ({
  session: { ...DEFAULT_SESSION, account: { ...DEFAULT_ACCOUNT } },
  apiBaseUrl: '',

  updateSession: (partial) =>
    set((state) => {
      const merged: CloudServiceSession = {
        ...state.session,
        ...partial,
        account: { ...state.session.account, ...(partial.account ?? {}) },
      };
      setCloudServiceToken(merged.token);
      return { session: merged };
    }),

  clearSession: () => {
    setCloudServiceToken('');
    set({ session: { ...DEFAULT_SESSION, account: { ...DEFAULT_ACCOUNT } } });
  },

  setApiBaseUrl: (url) => {
    const trimmed = (url || '').trim();
    setCloudApiBaseUrl(trimmed || DEFAULT_CLOUD_API_BASE_URL);
    set({ apiBaseUrl: trimmed });
  },

  resetApiBaseUrl: () => {
    setCloudApiBaseUrl(DEFAULT_CLOUD_API_BASE_URL);
    set({ apiBaseUrl: '' });
  },

  isLogin: () => {
    const { session } = get();
    return !!session.token && session.expire_at > Date.now() / 1000;
  },

  roleName: () => {
    const { session } = get();
    return CLOUD_SERVICE_ROLE_NAME_MAP[Number(session.account.role)] || '未知';
  },

  isAdmin: () => {
    const { session } = get();
    const mask = CloudServiceUserRole.Admin | CloudServiceUserRole.WebMaster;
    return (Number(session.account.role) & mask) !== 0;
  },
}));

/** 模块加载时挂接 401 → clearSession，client.ts 命中 SESSION_EXPIRED_ERROR_CODES 时调用此钩子 */
setSessionExpiredHandler(() => {
  useCloudServiceStore.getState().clearSession();
  // UI 层可订阅 store 变化触发登录弹窗
});
