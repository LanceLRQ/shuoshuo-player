import { buildBilibiliApiCall } from '../client';
import type { BilibiliVideo, DashAudioStream } from '../../types';

export interface VideoViewInfo extends BilibiliVideo {
  desc_v2?: Array<{ raw_text: string; type: number; biz_id?: number }>;
}

export interface VideoPlayUrlResponse {
  dash?: {
    audio: DashAudioStream[];
  };
  durl?: Array<{ url: string; backup_url: string[] }>;
}

export interface VideoSearchResponse {
  result: Array<{
    bvid: string;
    aid: number;
    typeid: string;
    arcurl: string;
    title: string;
    description: string;
    pic: string;
    play: number;
    pubdate: number;
    duration: string;
    author: string;
    mid: number;
  }>;
  numResults: number;
  page: number;
  pagesize: number;
}

export const VideoApi = {
  /** 视频详情 */
  getVideoViewInfo: buildBilibiliApiCall<VideoViewInfo>({
    url: 'https://api.bilibili.com/x/web-interface/view',
  }),

  /** DASH 音频流（WBI） */
  getVideoPlayurl: buildBilibiliApiCall<VideoPlayUrlResponse>({
    url: 'https://api.bilibili.com/x/player/wbi/playurl',
    useWbi: true,
  }),

  /** 播放统计模拟点击（WBI） */
  doClickStat: buildBilibiliApiCall<unknown>({
    url: 'https://api.bilibili.com/x/click-interface/click/web/h5',
    method: 'post',
    useWbi: true,
  }),

  /** 视频搜索 */
  searchVideo: buildBilibiliApiCall<VideoSearchResponse>({
    url: 'https://api.bilibili.com/x/web-interface/search/type',
  }),
};
