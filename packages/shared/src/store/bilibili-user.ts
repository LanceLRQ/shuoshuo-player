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
      if (__DEV_LOG__) {
        console.debug('[WBI-DEBUG] getUserInfo resolved', {
          isLogin: data.isLogin,
          hasWbiImg: Boolean(data.wbi_img),
          wbi_img: data.wbi_img,
        });
      }
      const isLogin = data.isLogin ?? false;

      // WBI 密钥与登录态无关；nav 接口即使返回 -101 也会回传 wbi_img
      if (data.wbi_img) {
        const extracted = {
          img_key: extractWbiKey(data.wbi_img.img_url),
          sub_key: extractWbiKey(data.wbi_img.sub_url),
        };
        if (__DEV_LOG__) console.debug('[WBI-DEBUG] extracted keys', extracted);
        setWbiInfo(extracted);
      } else if (__DEV_LOG__) {
        console.debug('[WBI-DEBUG] no wbi_img in nav response');
      }

      set({
        isInited: true,
        isLogin,
        current: isLogin ? data : null,
      });
    } catch (err) {
      if (__DEV_LOG__) console.debug('[WBI-DEBUG] getUserInfo failed', err);
      set({ isInited: true, isLogin: false, current: null });
    }
  },

  reset: () => set({ isInited: false, isLogin: false, current: null }),
}));
