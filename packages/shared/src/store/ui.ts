import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { NoticeType } from '../constants';

export type NoticeVertical = 'top' | 'bottom';
export type NoticeHorizontal = 'left' | 'center' | 'right';

export interface NoticeAction {
  label: string;
  onClick: () => void;
}

export interface NoticeItem {
  id: string;
  type: NoticeType;
  message: string;
  /** 默认 'top' */
  vertical: NoticeVertical;
  /** 默认 'center' */
  horizontal: NoticeHorizontal;
  /** null 表示不自动关闭 */
  duration: number | null;
  /** 是否显示关闭按钮 */
  close: boolean;
  /** 操作按钮 */
  action: NoticeAction | null;
}

export type SendNoticePayload = Partial<Omit<NoticeItem, 'message'>> & {
  id?: string;
  message: string;
};

interface UIState {
  notices: NoticeItem[];

  sendNotice: (notice: SendNoticePayload) => string;
  removeNotice: (id: string) => void;
  clearNotices: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  notices: [],

  sendNotice: (notice) => {
    const id = notice.id || nanoid();
    const obj: NoticeItem = {
      id,
      type: notice.type ?? NoticeType.INFO,
      message: notice.message,
      vertical: notice.vertical ?? 'top',
      horizontal: notice.horizontal ?? 'center',
      duration: notice.duration ?? null,
      close: notice.close ?? true,
      action: notice.action ?? null,
    };
    set((state) => {
      const idx = state.notices.findIndex((n) => n.id === id);
      if (idx >= 0) {
        const next = [...state.notices];
        next[idx] = obj;
        return { notices: next };
      }
      return { notices: [...state.notices, obj] };
    });
    return id;
  },

  removeNotice: (id) => set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })),

  clearNotices: () => set({ notices: [] }),
}));
