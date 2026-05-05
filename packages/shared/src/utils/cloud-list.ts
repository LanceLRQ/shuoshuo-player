import type { CloudListResponse } from '../types/cloud-service';

/**
 * v2 后端列表响应是 normalized 形态：
 *   { entities: { <entityKey>: { <id>: T } }, result: { <resultKey>: string[] }, pagination: {...} }
 * 调用层只关心展开后的 `T[]`，所有重组细节统一收敛到这里。
 *
 * 必须运行期 Array.isArray 兜底：TS 类型在 axios 反序列化路径上无强制力，后端任意一处把
 * 字段写成非数组都会让 `??` 直接透传，调用层 `.map(...)` 立刻在 React 渲染期抛
 * `u.map is not a function`。dev 模式下打印诊断信息便于定位是哪个键名/形态不匹配。
 */

export interface NormalizedKeys {
  /** entities 字典里的键名（如 'lyric'、'live_slicer_man'） */
  entityKey: string;
  /** result 对象里的键名（如 'lyrics'、'live_slicer_men'） */
  resultKey: string;
}

export function pickCloudList<T>(
  resp: CloudListResponse<T> | null | undefined,
  keys?: NormalizedKeys,
): T[] {
  if (!resp) return [];

  // v2 normalized 路径：result 是 {<resultKey>: id[]}，entities 是 {<entityKey>: {id: T}}
  if (keys && resp.result && !Array.isArray(resp.result)) {
    const ids = (resp.result as Record<string, string[] | undefined>)[keys.resultKey];
    const dict = resp.entities?.[keys.entityKey];
    if (!Array.isArray(ids) || !dict) {
      if (__DEV_LOG__) {
        console.warn('[cloud-list] normalized 解包失败：未找到 result/entities 对应键', {
          keys,
          resultKeys: Object.keys(resp.result ?? {}),
          entityKeys: Object.keys(resp.entities ?? {}),
        });
      }
      return [];
    }
    const items: T[] = [];
    for (const id of ids) {
      const entity = (dict as Record<string, T>)[String(id)];
      if (entity != null) items.push(entity);
    }
    return items;
  }

  // 兼容形态：result 直接是数组 / list 是数组
  const candidate = (Array.isArray(resp.result) ? resp.result : undefined) ?? resp.list;
  if (Array.isArray(candidate)) return candidate;
  if (__DEV_LOG__ && candidate != null) {
    console.warn('[cloud-list] result/list 字段不是数组，已兜底为 []', { candidate, resp });
  }
  return [];
}

export function pickCloudListTotal<T>(
  resp: CloudListResponse<T> | null | undefined,
  fallback: number,
): number {
  const total = resp?.pager?.total ?? resp?.pagination?.total;
  return typeof total === 'number' && Number.isFinite(total) ? total : fallback;
}
