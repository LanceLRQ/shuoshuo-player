import { create } from 'zustand';
import type { BilibiliUserInfo } from '../types';
import { UserApi, setWbiInfo, extractWbiKey } from '../api';

interface BilibiliUserState {
  isInited: boolean;
  isLogin: boolean;
  current: BilibiliUserInfo | null;

  getLoginUserInfo: () => Promise<void>;
  reset: () => void;
}

export const useBilibiliUserStore = create<BilibiliUserState>((set) => ({
  isInited: false,
  isLogin: false,
  current: null,

  getLoginUserInfo: async () => {
    try {
      const data = await UserApi.getUserInfo();
      const isLogin = data.isLogin ?? false;

      if (isLogin && data.wbi_img) {
        setWbiInfo({
          img_key: extractWbiKey(data.wbi_img.img_url),
          sub_key: extractWbiKey(data.wbi_img.sub_url),
        });
      }

      set({
        isInited: true,
        isLogin,
        current: isLogin ? data : null,
      });
    } catch {
      set({ isInited: true, isLogin: false, current: null });
    }
  },

  reset: () => set({ isInited: false, isLogin: false, current: null }),
}));
