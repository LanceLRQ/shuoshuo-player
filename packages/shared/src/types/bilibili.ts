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

/** B 站视频分 P 元数据（view 接口 pages[] 子集） */
export interface BilibiliVideoPage {
  /** 该 P 的 cid（取流必传） */
  cid: number;
  /** 该 P 的序号，从 1 开始 */
  page: number;
  /** 该 P 的标题 */
  part: string;
  /** 该 P 的时长，单位秒 */
  duration: number;
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
  /** 视频 1P 的 cid（便于不查 pages 的快速场景使用） */
  cid?: number;
  /** 分 P 总数；缺失视为 1 */
  videos?: number;
  /** 分 P 列表（view 模式入库时填充；列表 / 收藏夹模式可能缺失） */
  pages?: BilibiliVideoPage[];
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

/** WBI 密钥信息 */
export interface WbiInfo {
  img_key: string;
  sub_key: string;
}
