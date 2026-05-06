import { buildCloudApiCall } from '../client';
import type { CloudLyric, LyricSnapshot, CloudListResponse } from '../../types';

export interface LyricListParams {
  page?: number;
  limit?: number;
  keyword?: string;
}

export interface LyricSavePayload {
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

  /**
   * 保存歌词（bvid 寻址，新建/更新统一端点）。
   *
   * 后端按 bvid 自动 upsert：
   * - 数据库已有该 bvid 记录 → 更新（保留 id 不变）
   * - 数据库无记录 → 新建
   *
   * 路径用 `by-bvid/` 段与数字 id 端点显式区分语义，避免与 /lyric/manage/:id 混淆。
   */
  saveLyric: (bvid: string, data: LyricSavePayload) =>
    buildCloudApiCall<CloudLyric>({ url: `/lyric/manage/by-bvid/${bvid}`, method: 'post' })({
      data: data as unknown as Record<string, unknown>,
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
