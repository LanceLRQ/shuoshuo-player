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
  /**
   * 软删除标记：UP 主投稿/收藏夹「重新拉取全部」做删除对账后，本地存在但远端不存在的 bvid
   * 会被标记 invalid=true。CUSTOM 歌单引用到该 bvid 时仍正常展示但禁用播放，方便用户保留收藏记录。
   * 后续若远端恢复（用户重新拉取拿到该 bvid），upsertMany 会自动覆写为 false。
   */
  invalid?: boolean;
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

/** B 站用户名片（/x/web-interface/card 响应，免 WBI 免登录，含粉丝数 + 投稿数） */
export interface BilibiliUserCard {
  card: {
    mid: string;
    name: string;
    face: string;
    sign: string;
    fans: number;
    friend: number;
    attention: number;
  };
  /** 粉丝数（根级，与 card.fans 等价） */
  follower: number;
  /** 用户稿件数 */
  archive_count: number;
  /** 获赞数 */
  like_num: number;
}

/**
 * 直播切片主播本地缓存条目
 *
 * 更新感知用投稿数差分：缓存上次 archiveCount，本次变大即判定有新投稿，
 * 复用同一次 card 请求、零额外接口。lastUpdatedAt 是「发现变化的时刻」近似，
 * 非 B 站真实发布时间；删旧发新净值持平会漏检（切片场景可接受）。
 */
export interface LiveSlicerCacheEntry {
  mid: string;
  /** 取 card 最新值，展示优先于云端 LiveSlicerMan.name */
  name: string;
  face: string;
  follower: number;
  /** 当前投稿数（差分基线） */
  archiveCount: number;
  /** 上次成功拉取时刻（秒） */
  lastFetchedAt: number;
  /** 上次检测到投稿数「增加」的时刻（秒，0=从未） */
  lastUpdatedAt: number;
  /** 上次新增数量（角标 +N） */
  lastDelta: number;
  /** 有未读更新，用户点该卡片后清除 */
  hasUnread: boolean;
}

/** 视频列表缓存条目 */
export interface VideoListCacheEntry {
  update_time: number;
  video_list: Array<{ bvid: string; created: number }>;
  count: number;
  /**
   * 上次拉取使用的 mode。'' 表示从未拉取过；
   * 'default' 为 B-阶段早期遗留命名（语义=增量），与 'incremental' 等价；
   * 'incremental' / 'range' / 'fully' 为 C-阶段引入。
   */
  update_type: 'default' | 'incremental' | 'range' | 'fully' | '';
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

/**
 * B 站合集元信息（seasons_archives_list / seasons_series_list 响应中 meta 字段子集）
 *
 * 注：is_opened 仅在 UP 主创作中心 API (member.bilibili.com) 中返回；公开 web API
 * (polymer/web-space) 不返回该字段，但仍保留可选字段以做客户端兜底（=0 视为私密）。
 */
export interface BilibiliSeasonMeta {
  season_id: number;
  mid: number;
  name: string;
  cover: string;
  description: string;
  total: number;
  ptime?: number;
  is_opened?: number;
}

/**
 * B 站系列元信息（seasons_series_list / series/series 响应中 meta 字段子集）。
 *
 * 与 seasons 不同：ID 字段是 series_id；通过 seasons_series_list 端点拿到的 meta
 * 包含 cover（即使 series/series 单独查询不返回）。
 */
export interface BilibiliSeriesMeta {
  series_id: number;
  mid: number;
  name: string;
  cover?: string;
  description: string;
  total: number;
  ctime?: number;
  mtime?: number;
}

/**
 * 合集/系列内单条视频条目。
 * - seasons_archives_list 返回结构：含 stat.view
 * - series/archives 返回结构：基本一致，可能少部分字段
 */
export interface BilibiliSeasonVideo {
  aid: number;
  bvid: string;
  title: string;
  pic: string;
  pubdate: number;
  duration: number;
  stat?: { view: number };
}

export interface BilibiliSeasonsListItem {
  meta: BilibiliSeasonMeta;
  archives?: BilibiliSeasonVideo[];
}

export interface BilibiliSeriesListItem {
  meta: BilibiliSeriesMeta;
  archives?: BilibiliSeasonVideo[];
}

/** seasons_series_list 接口响应 data 字段 */
export interface BilibiliSeasonsListResponse {
  items_lists: {
    seasons_list?: BilibiliSeasonsListItem[];
    series_list?: BilibiliSeriesListItem[];
    page: { num: number; size: number; total: number };
  };
}

/** seasons_archives_list 接口响应 data 字段（合集详情） */
export interface BilibiliSeasonArchivesResponse {
  meta: BilibiliSeasonMeta;
  archives: BilibiliSeasonVideo[];
  page: { num: number; size: number; total: number };
}

/** series/archives 接口响应 data 字段（系列详情） */
export interface BilibiliSeriesArchivesResponse {
  aids?: number[];
  archives: BilibiliSeasonVideo[];
  page: { num: number; size: number; total: number };
}

/** UP 主歌单页「合集」Tab 用的统一抽象：seasons + series 二合一 */
export type UploaderCollectionSource = 'season' | 'series';
