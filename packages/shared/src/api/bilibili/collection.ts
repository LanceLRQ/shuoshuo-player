import { buildBilibiliApiCall } from '../client';
import type {
  BilibiliSeasonArchivesResponse,
  BilibiliSeasonMeta,
  BilibiliSeasonVideo,
  BilibiliSeasonsListResponse,
  BilibiliSeriesArchivesResponse,
  UploaderCollectionSource,
} from '../../types';

/**
 * B 站「合集 / 系列」相关 API。
 *
 * B 站在 UP 主页同时暴露两种内容组织：
 * - season（合集）：创作中心新功能，meta 含 season_id
 * - series（系列）：早期功能，meta 含 series_id；UI 上 UP 主和访客都统称"合集"
 *
 * 用户视角看，两者无差别——按"合集"统一展示；只在请求详情时分流到不同 API。
 */
export const CollectionApi = {
  /** UP 主合集 + 系列汇总列表（WBI）；items_lists.seasons_list / series_list 各自可空 */
  listSeasonsAndSeriesRaw: buildBilibiliApiCall<BilibiliSeasonsListResponse>({
    url: 'https://api.bilibili.com/x/polymer/web-space/seasons_series_list',
    useWbi: true,
  }),

  /** 合集（season）内视频列表（WBI） */
  getSeasonArchivesRaw: buildBilibiliApiCall<BilibiliSeasonArchivesResponse>({
    url: 'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list',
    useWbi: true,
  }),

  /** 系列（series）内视频列表（无需 WBI）；分页参数是 pn / ps */
  getSeriesArchivesRaw: buildBilibiliApiCall<BilibiliSeriesArchivesResponse>({
    url: 'https://api.bilibili.com/x/series/archives',
  }),
};

/** UI 直接消费的「合集/系列」统一抽象 */
export interface UploaderCollection {
  source: UploaderCollectionSource;
  /** season_id 或 series_id */
  id: number;
  mid: number;
  name: string;
  /** meta.cover 优先；空则用 archives[0]?.pic 兜底；都空 → '' */
  cover: string;
  description: string;
  total: number;
}

export interface UploaderCollectionsResult {
  items: UploaderCollection[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 拉取 UP 主的合集 + 系列汇总（UI 统称"合集"）。
 *
 * 合并策略：
 * - seasons_list / series_list 各自规整后按 API 返回顺序合并（seasons 在前）
 * - meta 字段差异折叠到 UploaderCollection 统一形态
 * - 私密内容兜底过滤：seasons 的 is_opened === 0（series 公开 API 不返回私密）
 * - 封面 fallback：meta.cover || archives[0]?.pic
 */
export async function fetchUploaderCollections(
  mid: string | number,
  page: number = 1,
  pageSize: number = 20,
): Promise<UploaderCollectionsResult> {
  const resp = await CollectionApi.listSeasonsAndSeriesRaw({
    params: { mid: String(mid), page_num: page, page_size: pageSize },
  });
  const rawSeasons = resp?.items_lists?.seasons_list ?? [];
  const rawSeries = resp?.items_lists?.series_list ?? [];
  const seasonItems: UploaderCollection[] = rawSeasons
    .filter((item) => item.meta.is_opened === undefined || item.meta.is_opened === 1)
    .map((item) => ({
      source: 'season',
      id: item.meta.season_id,
      mid: item.meta.mid,
      name: item.meta.name,
      cover: item.meta.cover || item.archives?.[0]?.pic || '',
      description: item.meta.description ?? '',
      total: item.meta.total ?? item.archives?.length ?? 0,
    }));
  const seriesItems: UploaderCollection[] = rawSeries.map((item) => ({
    source: 'series',
    id: item.meta.series_id,
    mid: item.meta.mid,
    name: item.meta.name,
    cover: item.meta.cover || item.archives?.[0]?.pic || '',
    description: item.meta.description ?? '',
    total: item.meta.total ?? item.archives?.length ?? 0,
  }));
  const items = [...seasonItems, ...seriesItems];
  const total = resp?.items_lists?.page?.total ?? items.length;
  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export interface CollectionArchivesResult {
  /** 合集名（season 模式 API 返回 meta，series 模式合并 list 给的 meta 不在详情接口里，由调用方注入） */
  name?: string;
  description?: string;
  cover?: string;
  archives: BilibiliSeasonVideo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const COLLECTION_ARCHIVES_PAGE_SIZE = 30;

/**
 * 拉取合集/系列内视频分页，按 source 路由不同 API。
 *
 * - season → seasons_archives_list（带 meta 元信息，page_num / page_size 命名）
 * - series → series/archives（无 meta，pn / ps 命名）
 */
export async function fetchCollectionArchives(
  mid: string | number,
  source: UploaderCollectionSource,
  collectionId: string | number,
  page: number = 1,
  pageSize: number = COLLECTION_ARCHIVES_PAGE_SIZE,
): Promise<CollectionArchivesResult> {
  if (source === 'season') {
    const resp = await CollectionApi.getSeasonArchivesRaw({
      params: {
        mid: String(mid),
        season_id: String(collectionId),
        page_num: page,
        page_size: pageSize,
      },
    });
    const total = resp?.page?.total ?? resp?.archives?.length ?? 0;
    const meta: BilibiliSeasonMeta | undefined = resp?.meta;
    return {
      name: meta?.name,
      description: meta?.description,
      cover: meta?.cover,
      archives: resp?.archives ?? [],
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }
  const resp = await CollectionApi.getSeriesArchivesRaw({
    params: { mid: String(mid), series_id: String(collectionId), pn: page, ps: pageSize },
  });
  const total = resp?.page?.total ?? resp?.archives?.length ?? 0;
  return {
    archives: resp?.archives ?? [],
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
