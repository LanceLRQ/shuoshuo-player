/**
 * 数据导入解析 + v1 兼容迁移 + 二态合并模式
 *
 * 设计要点：
 * - v2 导出 JSON 顶层注入 `version: "2"`；缺失则视为 v1
 * - 仅 fav_list / lyrics 参与导入（playing_list / ui_profile / bili_* 缓存等保持现有）
 * - v1 → v2 迁移仅作用于 fav_list.list[]：mid 数字→字符串、ms 时间戳→秒
 * - 合并模式：'skip'（跳过同名）/ 'replace'（覆盖同名），仅作用于 fav_list 与 lyrics
 * - **硬约束**：永远不删除 current 中"导入文件没出现"的项；
 *   type=1/2（B 站收藏夹/UP 主）即使在 'replace' 模式下也始终 append-only，
 *   因为 v1 / 旧导出文件中的 bv_ids 不可信，覆盖会洗掉用户在 v2 已手动刷新过的内容
 * - selectedFavIds 仅作用于 fav_list；lyrics 始终全量按 mode 合并（无 UI 勾选）
 */
import { EXPORT_KEYS } from '../constants';
import { FavListType, type FavListItem, type LyricEntry } from '../types';
import type { PersistedFavListShape, PersistedLyricsShape } from '../store/persisted-types';

export const CURRENT_EXPORT_VERSION = '2';

export type ImportVersion = '1' | '2';

export type MergeMode = 'skip' | 'replace';

export interface ImportPayload {
  fav_list: PersistedFavListShape;
  lyrics: PersistedLyricsShape;
}

export interface ImportSummary {
  version: ImportVersion;
  /** 已经做过 v1→v2 标准化的歌单列表，供 UI 直接渲染勾选 */
  favList: FavListItem[];
  /** lyrics.lyricMaps 的 key 数（歌词条目总数） */
  lyricCount: number;
}

export interface ParsedImport extends ImportSummary {
  /** 实际写回 storage 的最终形态（已标准化） */
  payload: ImportPayload;
}

/** 判断是否为 plain object（非 null、非数组、typeof === 'object'） */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * v1 fav_list item 标准化为 v2 形态
 * - id: 强转 string
 * - mid: number/非空字符串 → string；空字符串/null/undefined → undefined
 * - biliFavFolderId: 非空字符串保留，否则 undefined
 * - bv_ids: 仅保留 string 元素
 * - create_time / update_time: > 1e12（13 位毫秒）→ 除以 1000 转秒
 */
function normalizeV1FavItem(raw: Record<string, unknown>): FavListItem {
  const ms = raw.create_time;
  const mu = raw.update_time;
  const mid = raw.mid;
  const biliFav = raw.biliFavFolderId;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    type: raw.type as FavListType,
    mid: mid != null && mid !== '' ? String(mid) : undefined,
    biliFavFolderId: typeof biliFav === 'string' && biliFav !== '' ? biliFav : undefined,
    bv_ids: Array.isArray(raw.bv_ids)
      ? raw.bv_ids.filter((x: unknown): x is string => typeof x === 'string')
      : [],
    create_time: typeof ms === 'number' && ms > 1e12 ? Math.floor(ms / 1000) : Number(ms ?? 0) || 0,
    update_time: typeof mu === 'number' && mu > 1e12 ? Math.floor(mu / 1000) : Number(mu ?? 0) || 0,
  };
}

/**
 * 解析 + 校验任意 JSON 为合法导入数据 + 摘要
 *
 * 返回 null 的情况：
 * - 输入非 plain object
 * - 顶层不含任何 EXPORT_KEYS（防误投不相关 JSON，如 package.json）
 * - 命中的 EXPORT_KEYS 值不是 plain object（类型严重错位）
 * - version 字段存在但既不是 '2' / 2（未来版本不识别，鼓励显式升级）
 */
export function parseImportData(input: unknown): ParsedImport | null {
  if (!isPlainObject(input)) return null;

  // 版本识别：缺失 → v1；'2' / 2 → v2；其他 → reject
  const rawVersion = input.version;
  let version: ImportVersion;
  if (rawVersion === undefined) {
    version = '1';
  } else if (rawVersion === '2' || rawVersion === 2) {
    version = '2';
  } else {
    return null;
  }

  // 至少命中一个 EXPORT_KEYS
  const hits = EXPORT_KEYS.filter((k) => k in input);
  if (hits.length === 0) return null;

  // 命中的 key 必须是 plain object，否则视为类型错位
  for (const k of hits) {
    if (!isPlainObject(input[k])) return null;
  }

  // 提取 fav_list.list 并标准化
  const favListRaw = isPlainObject(input.fav_list) ? input.fav_list : {};
  const rawList = Array.isArray(favListRaw.list) ? favListRaw.list : [];
  const favList: FavListItem[] = rawList
    .filter(isPlainObject)
    .map((item) => (version === '1' ? normalizeV1FavItem(item) : (item as unknown as FavListItem)))
    // 防御：丢弃 id 为空 / type 不是 0/1/2 的脏数据
    .filter((it) => it.id !== '' && [0, 1, 2].includes(it.type as number));

  // 提取 lyrics.lyricMaps
  const lyricsRaw = isPlainObject(input.lyrics) ? input.lyrics : {};
  const lyricMapsRaw = isPlainObject(lyricsRaw.lyricMaps) ? lyricsRaw.lyricMaps : {};
  const lyricMaps: Record<string, LyricEntry> = {};
  for (const [k, v] of Object.entries(lyricMapsRaw)) {
    if (isPlainObject(v)) lyricMaps[k] = v as unknown as LyricEntry;
  }
  const lyricCount = Object.keys(lyricMaps).length;

  return {
    version,
    favList,
    lyricCount,
    payload: {
      fav_list: { list: favList },
      lyrics: { lyricMaps },
    },
  };
}

/**
 * 按合并模式构造写回 storage 的 fav_list / lyrics
 *
 * - mode='skip'：勾选项中已存在同 id 的歌单 → 跳过（保护现有）；新 id → 追加
 * - mode='replace'：勾选项中 type=0 的同 id → 用导入版本覆盖；新 id → 追加
 *
 * **硬约束**（两种模式共同遵守）：
 * 1. 永远不删除 current 中"导入文件没出现"的项
 * 2. fav_list 中 type=1/2（B 站收藏夹/UP 主）即使在 replace 模式下也始终 append-only，
 *    因为 v1 / 旧导出的 bv_ids 不可信，覆盖会洗掉用户在 v2 已手动刷新过的内容
 *
 * selectedFavIds：仅作用于 fav_list；undefined 时视为全选。
 * lyrics：始终全量按 mode 合并（无 UI 勾选；replace 用导入覆盖同 bvid，skip 仅追加新 bvid）。
 *
 * 注意：本函数仅返回 fav_list / lyrics 两个 key 的新值；调用方负责将其他 EXPORT_KEYS
 * 与 cloud_service / music_url_cache / playing_list / ui_profile 等"不导入项"原样保留。
 */
export function buildMerged(
  current: { fav_list?: PersistedFavListShape; lyrics?: PersistedLyricsShape },
  imported: ImportPayload,
  mode: MergeMode,
  selectedFavIds?: ReadonlySet<string>,
): { fav_list: PersistedFavListShape; lyrics: PersistedLyricsShape } {
  const currentFavList = current.fav_list?.list ?? [];
  const currentLyricMaps = current.lyrics?.lyricMaps ?? {};

  const importedFavList = (imported.fav_list.list ?? []).filter(
    (it) => !selectedFavIds || selectedFavIds.has(it.id),
  );
  const importedLyricMaps = imported.lyrics.lyricMaps ?? {};

  // fav_list 合并：
  // - 计算"可被替换的 id 集合"= 导入项中 type=0 且 mode='replace' 的 id
  //   （type=1/2 永远 append-only，硬约束）
  // - current 中：在替换集合里的项剔除（让位给导入版本），其他保留
  // - 导入项中：未撞 id 的全部追加；撞 id 但不在替换集合里的（type=1/2 或 mode=skip）跳过
  const replaceableIds = new Set(
    mode === 'replace'
      ? importedFavList.filter((it) => it.type === FavListType.CUSTOM).map((it) => it.id)
      : [],
  );
  const currentIds = new Set(currentFavList.map((it) => it.id));
  const keptCurrent = currentFavList.filter((it) => !replaceableIds.has(it.id));
  const newOrReplaced = importedFavList.filter((it) =>
    replaceableIds.has(it.id) ? true : !currentIds.has(it.id),
  );
  const mergedFavList: FavListItem[] = [...keptCurrent, ...newOrReplaced];

  // lyrics 合并（始终全量；replace 覆盖同 bvid，skip 仅追加新 bvid）
  let mergedLyricMaps: Record<string, LyricEntry>;
  if (mode === 'replace') {
    mergedLyricMaps = { ...currentLyricMaps, ...importedLyricMaps };
  } else {
    mergedLyricMaps = { ...currentLyricMaps };
    for (const [k, v] of Object.entries(importedLyricMaps)) {
      if (!(k in mergedLyricMaps)) mergedLyricMaps[k] = v;
    }
  }

  return {
    fav_list: { list: mergedFavList },
    lyrics: { lyricMaps: mergedLyricMaps },
  };
}
