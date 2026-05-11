import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

/**
 * Tauri 端音频缓存管理 - 前端 invoke 包装
 *
 * 与 Rust 端 `commands::audio_cache::{get_cache_stats, set_cache_max_bytes, clear_cache}` 对应。
 * 仅在 Tauri 平台调用；Web/扩展端不应 import 此模块（运行时 invoke 会失败）。
 */

/** 与 Rust CacheStats 结构对齐 */
export interface CacheStats {
  current_bytes: number;
  max_bytes: number;
  entry_count: number;
}

/** 查询当前缓存统计 */
export async function getCacheStats(): Promise<CacheStats> {
  return invoke<CacheStats>('get_cache_stats');
}

/**
 * 修改缓存容量上限（字节）。
 *
 * Rust 端会自动 clamp 到 [256MB, 50GB] 区间，超量时立即驱逐最旧项。
 * 配置自动持久化到 plugin-store（audio_cache_settings.json），重启保留。
 *
 * @returns 修改后的最新统计（含可能被驱逐后的 current_bytes）
 */
export async function setCacheMaxBytes(bytes: number): Promise<CacheStats> {
  return invoke<CacheStats>('set_cache_max_bytes', { bytes });
}

/** 一键清空所有缓存（删除磁盘文件 + 清 LRU + 清 mem cache + 重写空索引） */
export async function clearCache(): Promise<void> {
  await invoke<void>('clear_cache');
}

/** 当前生效的缓存目录路径（启动时确定，运行时不变） */
export async function getCacheDir(): Promise<string> {
  return invoke<string>('get_cache_dir');
}

/**
 * 设置自定义缓存目录。
 *
 * - 传 `null` / 空字符串：恢复默认（删除自定义配置）
 * - 立即清空当前缓存（旧路径下文件 + 索引）+ 持久化新路径
 * - **重启应用后才生效**（避免运行时迁移逻辑复杂）
 */
export async function setCacheDir(path: string | null): Promise<void> {
  await invoke<void>('set_cache_dir', { path });
}

/**
 * 弹 OS 文件夹选择对话框。返回选中的绝对路径或 null（用户取消）。
 * 仅在 Tauri 平台可用。
 */
export async function pickCacheDir(currentPath?: string): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: '选择音频缓存目录',
    defaultPath: currentPath,
  });
  if (!selected) return null;
  // openDialog directory:true 单选时返回 string；multiple:false 不应得到数组，但保险处理
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}
