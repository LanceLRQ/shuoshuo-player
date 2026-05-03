/** B 站登录用户信息（/x/web-interface/nav 响应） */
export interface BilibiliUserInfo {
  isLogin?: boolean;
  face: string;
  uname: string;
  mid: number;
  vipType: number;
  vip_pay_type: number;
  wbi_img: {
    img_url: string;
    sub_url: string;
  };
}

/** B 站视频实体 */
export interface BilibiliVideo {
  aid: number;
  bvid: string;
  created: number;
  length: string;
  pic: string;
  is_union_video: boolean;
  title: string;
  sub_title: string;
  play: number;
  comment: number;
  author: string;
  description: string;
  mid?: number;
  cid?: number;
}

/** UP 主空间信息（/x/space/wbi/acc/info 响应字段拾取） */
export interface BilibiliSpaceInfo {
  name: string;
  mid: number;
  face: string;
  sign: string;
  sex: string;
  tags?: string[];
  top_photo?: string;
  stats?: {
    follower: number;
    following: number;
    view: number;
    likes: number;
  };
}

/** 视频列表缓存条目 */
export interface VideoListCacheEntry {
  update_time: number;
  video_list: Array<{ bvid: string; created: number }>;
  count: number;
  update_type: 'default' | 'fully' | '';
}

/** B 站收藏夹缓存条目（继承视频列表 + 元信息） */
export interface FavFolderCacheEntry extends VideoListCacheEntry {
  info: Record<string, unknown>;
}

/** DASH 音频流（/x/player/wbi/playurl 中 dash.audio[]）
 *  字段命名以 B 站官方文档为准（snake_case）：
 *  https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/video/videostream_url.md */
export interface DashAudioStream {
  id: number;
  base_url: string;
  backup_url: string[];
  bandwidth: number;
  codecid: number;
}

/** 音乐播放 URL 全局缓存条目 */
export interface MusicUrlCache {
  loading: boolean;
  last_update: number;
  viewInfo: Record<string, unknown>;
  playInfo: Record<string, unknown>;
  playUrl: string;
}

/** WBI 密钥信息 */
export interface WbiInfo {
  img_key: string;
  sub_key: string;
}
