import { buildCloudApiCall } from '../client';
import type { LiveSlicerMan, CloudListResponse } from '../../types';

export interface LiveSlicerListParams {
  page?: number;
  limit?: number;
  keyword?: string;
}

export interface LiveSlicerSavePayload {
  /** B 站 UID（字符串，支持超大 UID） */
  mid: string;
  name?: string;
  face?: string;
}

export const LiveSlicerApi = {
  /** 公开列表（分页+搜索） */
  publicList: (params?: LiveSlicerListParams) =>
    buildCloudApiCall<CloudListResponse<LiveSlicerMan>>({
      url: '/live_slicer_men/list',
    })({ params }),

  /** 管理员列表（分页+搜索） */
  manageList: (params?: LiveSlicerListParams) =>
    buildCloudApiCall<CloudListResponse<LiveSlicerMan>>({
      url: '/live_slicer_men/manage/list',
    })({ params }),

  /** 创建（id 字面量 'new'） */
  create: (data: LiveSlicerSavePayload) =>
    buildCloudApiCall<LiveSlicerMan>({
      url: '/live_slicer_men/manage/new',
      method: 'post',
    })({ data: data as unknown as Record<string, unknown> }),

  /** 更新（按数字 ID） */
  update: (id: number, data: Partial<LiveSlicerSavePayload>) =>
    buildCloudApiCall<LiveSlicerMan>({
      url: `/live_slicer_men/manage/${id}`,
      method: 'post',
    })({ data: data as Record<string, unknown> }),

  /** 删除（软删除） */
  delete: (id: number) =>
    buildCloudApiCall<{ id: number; result: string }>({
      url: `/live_slicer_men/manage/${id}`,
      method: 'delete',
    })(),
};
