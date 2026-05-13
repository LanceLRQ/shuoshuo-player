/// <reference types="chrome" />
/**
 * v1 → v2 数据迁移检测与清理（Chrome 扩展专属）
 *
 * 背景：v1 与 v2 共享同一份 chrome.storage.local（同 extension origin），
 * v2 自动更新到用户浏览器后，v1 写入的 7 个 slice key 仍然存在；若不主动检测，
 * 用户会以为「歌单全丢了」。本模块负责：检测 → 解析 → 备份导出 → 清理。
 *
 * 设计要点：
 * - 所有 chrome.storage.local 原生调用都收敛在此文件，业务层只用 store + 这些函数
 * - 守卫 getPlatformBridge().type === 'chrome-extension'：Tauri / 普通 web 直接 no-op
 * - dismissed 标志独立 key：写入后即使 v1 数据未删也不再弹（半失败兜底）
 */
import {
  getPlatformBridge,
  parseImportData,
  objectToDownload,
  type ParsedImport,
} from '@shuoshuo-player/shared';

/** v1（v1/shuoshuo-player/src/constants.js → persistKeys）持久化的 7 个 slice key */
export const V1_PERSIST_KEYS = [
  'bili_user_videos',
  'bili_videos',
  'playing_list',
  'fav_list',
  'ui_profile',
  'lyrics',
  'cloud_service',
] as const;

/** 永久放弃迁移的标志位 key（独立于 v1/v2 的业务 key） */
export const V1_DISMISS_KEY = 'v1_migration_dismissed';

export interface V1Snapshot {
  /** chrome.storage.local 中读到的原始 7 个 key，供「下载备份」全量导出 */
  raw: Record<string, unknown>;
  /** 经 parseImportData 标准化后的可导入数据（剥离 cloud_service，登录态不参与导入） */
  parsed: ParsedImport;
}

/** 仅 chrome-extension 平台返回 true；Tauri / 普通 web 返回 false 让调用方 no-op */
function isChromeExtensionEnv(): boolean {
  try {
    return getPlatformBridge().type === 'chrome-extension';
  } catch {
    return false;
  }
}

/**
 * 检测 chrome.storage.local 中是否存在 v1 旧数据
 *
 * 返回 null 的情况：
 * - 非扩展环境（Tauri / 普通 web 调试）
 * - 已写入 V1_DISMISS_KEY=true（用户已选「永久放弃」）
 * - 7 个 v1 key 全部不存在或全部为空
 * - parseImportData 解析失败（异常的旧数据结构）
 */
export async function detectV1Snapshot(): Promise<V1Snapshot | null> {
  if (!isChromeExtensionEnv()) return null;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;

  // 已 dismissed 直接跳过；放在 detect 最前避免不必要的 storage 读取
  const dismissResult = await chrome.storage.local.get([V1_DISMISS_KEY]);
  if (dismissResult[V1_DISMISS_KEY]) return null;

  const raw = await chrome.storage.local.get([...V1_PERSIST_KEYS]);

  // 有效性判定：fav_list / lyrics / bili_videos 任一非空才视为「有迁移价值」
  // bili_user_videos / playing_list / ui_profile 单独存在不触发（避免空 v1 安装弹窗）
  const favList = raw.fav_list as { list?: unknown[] } | undefined;
  const lyrics = raw.lyrics as { lyricMaps?: Record<string, unknown> } | undefined;
  const videos = raw.bili_videos as { entities?: Record<string, unknown> } | undefined;

  const hasData =
    (Array.isArray(favList?.list) && favList.list.length > 0) ||
    (lyrics?.lyricMaps && Object.keys(lyrics.lyricMaps).length > 0) ||
    (videos?.entities && Object.keys(videos.entities).length > 0);

  if (!hasData) return null;

  // 拼装 parseImportData 输入：
  // - 不含顶层 version 字段 → 触发 v1 标准化路径（毫秒时间戳除 1000、mid 数字转 string）
  // - 剥离 cloud_service：用户决策不迁移登录态（v1 后端 ≠ v2 后端，token 不通用）
  const importInput: Record<string, unknown> = {
    fav_list: raw.fav_list ?? { list: [] },
    lyrics: raw.lyrics ?? { lyricMaps: {} },
    bili_videos: raw.bili_videos ?? { entities: {}, ids: [] },
  };
  // 可选 key 仅在存在时透传，避免 parseImportData 误判 plain object
  if (raw.bili_user_videos !== undefined) importInput.bili_user_videos = raw.bili_user_videos;
  if (raw.playing_list !== undefined) importInput.playing_list = raw.playing_list;
  if (raw.ui_profile !== undefined) importInput.ui_profile = raw.ui_profile;

  const parsed = parseImportData(importInput);
  if (!parsed) return null;

  return { raw, parsed };
}

/** 导出 v1 数据为 JSON 文件（包含 cloud_service 全量备份） */
export async function exportV1Backup(raw: Record<string, unknown>): Promise<'saved' | 'cancelled'> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return objectToDownload(raw, `shuoshuo-v1-backup_${stamp}.json`);
}

/** 清理 v1 留下的 7 个 key（迁移完成后调用） */
export async function clearV1Storage(): Promise<void> {
  if (!isChromeExtensionEnv()) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.remove([...V1_PERSIST_KEYS]);
}

/**
 * 永久放弃迁移：先写 dismissed 标志，再删 v1 keys
 * 顺序保证：即便 remove 一半失败，下次启动 dismissed 命中也不会再弹
 */
export async function dismissV1Migration(): Promise<void> {
  if (!isChromeExtensionEnv()) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [V1_DISMISS_KEY]: true });
  await chrome.storage.local.remove([...V1_PERSIST_KEYS]);
}

/**
 * 【dev 工具】v1 实际持久化但**会出现在 v1 导出 JSON** 中的 6 个 key
 * （cloud_service 不在 v1 导出列表里 → 模拟老用户场景时也不需要它）
 */
const V1_SEED_KEYS = [
  'bili_user_videos',
  'bili_videos',
  'playing_list',
  'fav_list',
  'ui_profile',
  'lyrics',
] as const;

export interface SeedV1Result {
  /** 实际写入 chrome.storage.local 的 v1 key 列表 */
  writtenKeys: string[];
  /** 被一同清理的 v2 状态 key 列表（player_data + dismissed flag） */
  clearedKeys: string[];
}

/**
 * 【dev 工具】将 v1 导出的 JSON 反向写入 chrome.storage.local，模拟「老用户升级」场景
 *
 * 流程：
 * 1. 从 JSON 中拣出 V1_SEED_KEYS 的字段（其余字段如 v2 的 favorites / version 字段忽略）
 * 2. 直接以「对象」形式写入 chrome.storage.local（v1 风格，不 JSON.stringify）
 * 3. 清掉 v2 自身状态（player_data + V1_DISMISS_KEY），保证 reload 后迁移弹层能弹
 *
 * 仅扩展环境可用；prod 构建中调用方走 `__DEV_LOG__` 守卫，整段 DCE。
 *
 * @throws JSON 中没有任何 v1 已知 key（fav_list / lyrics / bili_videos 等） → 立刻报错
 */
export async function seedV1FromExportJson(
  exportJson: Record<string, unknown>,
): Promise<SeedV1Result> {
  if (!isChromeExtensionEnv()) {
    throw new Error('seedV1FromExportJson 仅在 Chrome 扩展环境可用');
  }
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    throw new Error('chrome.storage.local 不可用');
  }

  const toWrite: Record<string, unknown> = {};
  for (const key of V1_SEED_KEYS) {
    const value = exportJson[key];
    if (value !== undefined && value !== null) {
      toWrite[key] = value;
    }
  }
  if (Object.keys(toWrite).length === 0) {
    throw new Error('JSON 中不包含任何 v1 已知 key（fav_list / lyrics / bili_videos 等）');
  }

  await chrome.storage.local.set(toWrite);

  // 清 v2 自身状态：避免 dismissed flag 残留导致 reload 后迁移弹层不弹
  const clearedKeys = ['player_data', V1_DISMISS_KEY];
  await chrome.storage.local.remove(clearedKeys);

  return { writtenKeys: Object.keys(toWrite), clearedKeys };
}

/**
 * 【dev 工具】清空 chrome.storage.local 的全部内容（v1 + v2 + dismiss flag）
 *
 * 让扩展回到「首次安装」状态，便于反复测试不同入口路径。
 */
export async function resetAllStorage(): Promise<void> {
  if (!isChromeExtensionEnv()) {
    throw new Error('resetAllStorage 仅在 Chrome 扩展环境可用');
  }
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.clear();
}
