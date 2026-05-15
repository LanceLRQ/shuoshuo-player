import { buildBilibiliApiCall } from '../client';
import type {
  BilibiliSeasonArchivesResponse,
  BilibiliSeasonMeta,
  BilibiliSeasonVideo,
  BilibiliSeasonsListResponse,
} from '../../types';

/**
 * B 站「视频合集」相关 API。
 *
 * 公开 polymer/web-space 端点：
 * - seasons_series_list：UP 主合集 + 系列汇总（本仓只用 seasons_list，丢 series）
 * - seasons_archives_list：单个合集内视频分页
 *
 * 两个端点的 WBI 签名实测可选——但被风控时会强制要求；统一走 useWbi:true 兜底。
 */
export const CollectionApi = {
  listSeasonsAndSeriesRaw: buildBilibiliApiCall<BilibiliSeasonsListResponse>({
    url: 'https://api.bilibili.com/x/polymer/web-space/seasons_series_list',
    useWbi: true,
  }),

  getSeasonArchivesRaw: buildBilibiliApiCall<BilibiliSeasonArchivesResponse>({
    url: 'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list',
    useWbi: true,
  }),
};

/** 适配后的合集列表项；UI 直接消费此结构而非 raw 响应 */
export interface UploaderSeason {
  meta: BilibiliSeasonMeta;
  /** meta.cover 优先；空则用合集内最新视频封面 archives[0]?.pic 兜底；都空 → '' */
  effectiveCover: string;
}

export interface UploaderSeasonsResult {
  items: UploaderSeason[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 拉取 UP 主公开合集列表。
 *
 * 适配处理：
 * - 仅取 items_lists.seasons_list，丢弃 series_list（产品决定只接合集不接系列）
 * - 客户端兜底过滤 is_opened === 0（实际 web API 不返回私密合集，此处仅做防御）
 * - 封面 fallback：meta.cover || archives[0]?.pic
 */
export async function fetchUploaderSeasons(
  mid: string | number,
  page: number = 1,
  pageSize: number = 20,
): Promise<UploaderSeasonsResult> {
  const resp = await CollectionApi.listSeasonsAndSeriesRaw({
    params: {
      mid: String(mid),
      page_num: page,
      page_size: pageSize,
    },
  });
  const rawList = resp?.items_lists?.seasons_list ?? [];
  const items: UploaderSeason[] = rawList
    .filter((item) => item.meta.is_opened === undefined || item.meta.is_opened === 1)
    .map((item) => ({
      meta: item.meta,
      effectiveCover: item.meta.cover || item.archives?.[0]?.pic || '',
    }));
  const total = resp?.items_lists?.page?.total ?? items.length;
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export interface SeasonArchivesResult {
  meta: BilibiliSeasonMeta;
  archives: BilibiliSeasonVideo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 拉取合集内视频分页。
 *
 * sortReverse=true 时 B 站按"先发布在前"返回；默认按"最新在前"。
 */
export async function fetchSeasonArchives(
  mid: string | number,
  seasonId: string | number,
  page: number = 1,
  pageSize: number = 30,
  sortReverse: boolean = false,
): Promise<SeasonArchivesResult> {
  const resp = await CollectionApi.getSeasonArchivesRaw({
    params: {
      mid: String(mid),
      season_id: String(seasonId),
      page_num: page,
      page_size: pageSize,
      sort_reverse: sortReverse ? 1 : 0,
    },
  });
  const total = resp?.page?.total ?? resp?.archives?.length ?? 0;
  return {
    meta: resp.meta,
    archives: resp.archives ?? [],
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
