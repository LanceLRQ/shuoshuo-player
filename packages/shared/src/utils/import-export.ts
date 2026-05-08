/**
 * 数据导入解析 + v1 兼容迁移 + 三态合并模式
 *
 * 设计要点：
 * - v2 导出 JSON 顶层注入 `version: "2"`；缺失则视为 v1
 * - 仅 fav_list / lyrics 参与导入（playing_list / ui_profile / bili_* 缓存等保持现有）
 * - v1 → v2 迁移仅作用于 fav_list.list[]：mid 数字→字符串、ms 时间戳→秒
 * - 合并模式：append / replaceAndAppend / overwrite，仅作用于 fav_list 与 lyrics
 *   selectedFavIds 仅作用于 fav_list；lyrics 始终全量按 mode 合并
 */
import { EXPORT_KEYS } from '../constants';
import { FavListType, type FavListItem, type LyricEntry } from '../types';
import type { PersistedFavListShape, PersistedLyricsShape } from '../store/persisted-types';

export const CURRENT_EXPORT_VERSION = '2';

export type ImportVersion = '1' | '2';

export type MergeMode = 'append' | 'replaceAndAppend' | 'overwrite';

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
 * - mode='append'：仅添加 current 中不存在的项（按主键 id / bvid 去重）
 * - mode='replaceAndAppend'：覆盖同主键的项 + 加入新项；保留 current 中导入文件没有的项
 * - mode='overwrite'：用 selected 直接替换（current 在 EXPORT_KEYS 范围内被清掉）
 *
 * selectedFavIds 仅作用于 fav_list；undefined 时全选。
 * lyrics 始终全量按 mode 合并（无 UI 勾选）。
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

  // overwrite 模式忽略 selectedFavIds（强制全量）
  const effectiveSelected = mode === 'overwrite' ? undefined : selectedFavIds;
  const importedFavList = (imported.fav_list.list ?? []).filter(
    (it) => !effectiveSelected || effectiveSelected.has(it.id),
  );
  const importedLyricMaps = imported.lyrics.lyricMaps ?? {};

  let mergedFavList: FavListItem[];
  let mergedLyricMaps: Record<string, LyricEntry>;

  switch (mode) {
    case 'overwrite': {
      mergedFavList = importedFavList;
      mergedLyricMaps = { ...importedLyricMaps };
      break;
    }
    case 'replaceAndAppend': {
      const importedIds = new Set(importedFavList.map((it) => it.id));
      // 保留 current 中"导入没覆盖的"，再追加导入项（导入项整体替换同 id）
      const kept = currentFavList.filter((it) => !importedIds.has(it.id));
      mergedFavList = [...kept, ...importedFavList];
      mergedLyricMaps = { ...currentLyricMaps, ...importedLyricMaps };
      break;
    }
    case 'append': {
      const currentIds = new Set(currentFavList.map((it) => it.id));
      const newOnly = importedFavList.filter((it) => !currentIds.has(it.id));
      mergedFavList = [...currentFavList, ...newOnly];
      // lyrics: 仅添加 current 没有的 bvid
      mergedLyricMaps = { ...currentLyricMaps };
      for (const [k, v] of Object.entries(importedLyricMaps)) {
        if (!(k in mergedLyricMaps)) mergedLyricMaps[k] = v;
      }
      break;
    }
  }

  return {
    fav_list: { list: mergedFavList },
    lyrics: { lyricMaps: mergedLyricMaps },
  };
}
