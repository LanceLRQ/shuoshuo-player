import { buildCloudApiCall } from '../client';
import type { CloudLyric, LyricSnapshot, CloudListResponse } from '../../types';

export interface LyricListParams {
  page?: number;
  limit?: number;
  keyword?: string;
}

export interface LyricSavePayload {
  /** 创建时必填；更新时可省略 */
  bvid?: string;
  title?: string;
  /** LRC 文本（v2 字段名 content，v1 旧字段是 lyric） */
  content: string;
}

export const LyricApi = {
  /** 公开接口：按 BVID 获取歌词（带 60/min 设备级限流） */
  getLyricByBvid: (bvid: string) => buildCloudApiCall<CloudLyric>({ url: `/lyric/${bvid}` })(),

  /** 管理列表（分页+搜索） */
  getLyricList: (params?: LyricListParams) =>
    buildCloudApiCall<CloudListResponse<CloudLyric>>({ url: '/lyric/manage/list' })({ params }),

  /** 创建歌词（id 字面量 'new'） */
  createLyric: (data: LyricSavePayload) =>
    buildCloudApiCall<CloudLyric>({ url: '/lyric/manage/new', method: 'post' })({
      data: data as unknown as Record<string, unknown>,
    }),

  /** 更新歌词（按数字 ID） */
  updateLyric: (id: number, data: Partial<LyricSavePayload>) =>
    buildCloudApiCall<CloudLyric>({ url: `/lyric/manage/${id}`, method: 'post' })({
      data: data as Record<string, unknown>,
    }),

  /**
   * 历史快照（按 lyric.id，最多返回 10 条）。
   * v2 normalized：entities.lyric_snapshot + entities.account（作者通过 author_id 反查），
   * result.lyric_snapshots = id 数组。caller 走 pickCloudList + 手动 join author。
   */
  getLyricHistory: (id: number) =>
    buildCloudApiCall<CloudListResponse<LyricSnapshot>>({
      url: `/lyric/manage/${id}/snap`,
    })(),

  /** 删除歌词（软删除，按数字 ID） */
  deleteLyric: (id: number) =>
    buildCloudApiCall<{ id: number; result: string }>({
      url: `/lyric/manage/${id}`,
      method: 'delete',
    })(),
};
