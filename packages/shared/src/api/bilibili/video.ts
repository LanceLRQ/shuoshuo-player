import { buildBilibiliApiCall } from '../client';
import type { BilibiliVideo, DashAudioStream } from '../../types';

export interface VideoViewInfo extends BilibiliVideo {
  desc_v2?: Array<{ raw_text: string; type: number; biz_id?: number }>;
}

export interface VideoPlayUrlResponse {
  dash?: {
    audio: DashAudioStream[];
    /** 杜比全景声伴音（大会员，type: 1 普通 / 2 全景；视频无杜比时为 null） */
    dolby?: { type?: number; audio: DashAudioStream[] | null } | null;
    /** Hi-Res 无损伴音（大会员，display 控制按钮显示；视频无无损时为 null） */
    flac?: { display?: boolean; audio: DashAudioStream | null } | null;
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
  /** 视频详情（WBI） */
  getVideoViewInfo: buildBilibiliApiCall<VideoViewInfo>({
    url: 'https://api.bilibili.com/x/web-interface/wbi/view',
    useWbi: true,
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

  /** 视频搜索（WBI） */
  searchVideo: buildBilibiliApiCall<VideoSearchResponse>({
    url: 'https://api.bilibili.com/x/web-interface/wbi/search/type',
    useWbi: true,
  }),
};
