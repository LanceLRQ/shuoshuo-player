import type { CloudListResponse } from '../types/cloud-service';

/**
 * 后端列表响应字段名既出现 list 也出现 result，pager 字段名既出现 pager 也出现 pagination；
 * 调用层若散落 `resp?.result ?? resp?.list ?? []` 与 `resp?.pager?.total ?? resp?.pagination?.total ?? items.length`
 * 容易出现取值顺序不一致。统一收敛到本工具，调整后端契约时只改一处。
 */

export function pickCloudList<T>(resp: CloudListResponse<T> | null | undefined): T[] {
  return resp?.result ?? resp?.list ?? [];
}

export function pickCloudListTotal<T>(
  resp: CloudListResponse<T> | null | undefined,
  fallback: number,
): number {
  return resp?.pager?.total ?? resp?.pagination?.total ?? fallback;
}
