import { create } from 'zustand';
import type { ParsedImport } from '@shuoshuo-player/shared';

/**
 * v1 → v2 迁移弹层状态机（纯瞬态，不参与持久化）
 *
 * 状态流转：
 *   idle ─(启动检测到 v1 数据)──→ prompt
 *   prompt ─(立即导入)──→ choosing ─(确认)──→ completed
 *                       ─(取消)──→ prompt
 *   prompt ─(永久放弃)──→ dismissing ─(确认)──→ dismissed
 *                                    ─(取消)──→ prompt
 *   prompt ─(稍后再说)──→ idle（保留 v1 数据，下次启动再检测）
 *
 * 注意：本 store 不进 PERSIST_KEYS，避免污染 player_data 持久化快照。
 */
export type MigrationStatus =
  | 'idle'
  | 'prompt'
  | 'choosing'
  | 'dismissing'
  | 'completed'
  | 'dismissed';

interface V1MigrationState {
  status: MigrationStatus;
  /** chrome.storage.local 中读到的原始 v1 数据，用于「下载备份」 */
  rawV1Data: Record<string, unknown> | null;
  /** parseImportData 解析后的可导入数据 + 摘要 */
  parsed: ParsedImport | null;

  /** 启动期检测到 v1 数据 */
  setPending: (raw: Record<string, unknown>, parsed: ParsedImport) => void;
  /** 用户点「立即导入」→ 打开 ImportDataDialog */
  startChoosing: () => void;
  /** 用户在 ImportDataDialog 内点「取消」→ 退回主提示 */
  cancelChoosing: () => void;
  /** 用户点「永久放弃」→ 打开二次确认 */
  startDismissing: () => void;
  /** 用户在二次确认内点「取消」→ 退回主提示 */
  cancelDismissing: () => void;
  /** 用户点「稍后再说」→ 释放数据，下次启动重新触发 */
  postpone: () => void;
  /** 导入流程完成（数据已写入 player_data + v1 storage 已清理） */
  markCompleted: () => void;
  /** 永久放弃完成（dismissed 标志已写入 + v1 storage 已清理） */
  markDismissed: () => void;
}

export const useV1MigrationStore = create<V1MigrationState>((set) => ({
  status: 'idle',
  rawV1Data: null,
  parsed: null,
  setPending: (rawV1Data, parsed) => set({ status: 'prompt', rawV1Data, parsed }),
  startChoosing: () => set({ status: 'choosing' }),
  cancelChoosing: () => set({ status: 'prompt' }),
  startDismissing: () => set({ status: 'dismissing' }),
  cancelDismissing: () => set({ status: 'prompt' }),
  postpone: () => set({ status: 'idle', rawV1Data: null, parsed: null }),
  markCompleted: () => set({ status: 'completed', rawV1Data: null, parsed: null }),
  markDismissed: () => set({ status: 'dismissed', rawV1Data: null, parsed: null }),
}));
