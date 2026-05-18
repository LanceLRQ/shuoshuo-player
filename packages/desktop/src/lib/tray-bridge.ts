import { invoke } from '@tauri-apps/api/core';

/**
 * Tauri 端托盘菜单文案的前端 invoke 包装
 *
 * 与 Rust 端 `commands::tray::{tray_set_track_label, tray_set_play_state}` 对应。
 * 由 tray-sync 订阅 store 变化驱动调用——曲目切换 / isPlaying 翻转时同步推送。
 *
 * 仅 Tauri 平台调用；Web/扩展端不应 import 此模块（运行时 invoke 会失败）。
 */

/**
 * 更新托盘菜单顶部"当前曲目"标签。
 * 空串表示"未在播放"，Rust 端会渲染成默认文案。
 */
export async function setTrayTrackLabel(label: string): Promise<void> {
  await invoke<void>('tray_set_track_label', { label });
}

/**
 * 更新托盘菜单"播放/暂停"项的文案。
 * true → "暂停"；false → "播放"。
 */
export async function setTrayPlayState(isPlaying: boolean): Promise<void> {
  await invoke<void>('tray_set_play_state', { isPlaying });
}
