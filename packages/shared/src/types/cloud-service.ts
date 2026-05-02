/**
 * 类型已对齐 shuoshuo-crystal/backend（PostgreSQL + GORM）：
 * - 主键由 MongoDB ObjectID 改为 number（uint64）
 * - 角色枚举：User=1（v1 是 0）、Admin=512、WebMaster=1024，权限判定走位与 (role & mask) === mask
 * - 时间字段：created_at / updated_at / deleted_at（ISO 字符串）
 * - 歌词上传字段名 lyric → content
 */

/** 云服务用户角色 */
export enum CloudServiceUserRole {
  WebMaster = 1024,
  Admin = 512,
  User = 1,
}

/** 云服务账户 */
export interface CloudAccount {
  id: number;
  user_name: string;
  nick_name: string;
  email: string;
  avatar: string;
  role: CloudServiceUserRole | number;
  /** QQ 互联 OpenID */
  open_id?: string;
  /** 0 表示未锁定，否则为 Unix 时间戳（秒） */
  locked?: number;
  created_at: string;
  updated_at: string;
}

/** 云服务会话（与新版 /login 响应对齐） */
export interface CloudServiceSession {
  /** account.id */
  id: number;
  token: string;
  token_type: 'Bearer';
  /** Unix 时间戳（秒） */
  expire_at: number;
  account: CloudAccount;
}

/** 歌词条目（前端缓存用，bvid → 歌词文本） */
export interface LyricEntry {
  bvid: string;
  /** LRC 文本，对应后端 Lyric.content */
  lyricText: string;
  /** 偏移量（毫秒），仅前端缓存使用 */
  offset?: number;
  /** 上次拉取的时间戳，用于 TTL 判断 */
  timestamp?: number;
  /** 云端 lyric.id 缓存（编辑时使用，避免再次按 bvid 反查） */
  cloudLyricId?: number;
}

/** 歌词管理实体（对齐后端 Lyric 模型） */
export interface CloudLyric {
  id: number;
  bvid: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** 歌词快照（对齐 LyricSnapshot 模型，最多保留 10 条） */
export interface LyricSnapshot {
  id: number;
  lyric_id: number;
  author_id?: number;
  author?: CloudAccount;
  title: string;
  content: string;
  created_at: string;
}

/** 直播切片管理员（对齐 LiveSlicerMan 模型，mid 为字符串支持超大 UID） */
export interface LiveSlicerMan {
  id: number;
  mid: string;
  name: string;
  face: string;
  created_at: string;
  updated_at: string;
}

/** 通用分页响应 */
export interface CloudPager {
  page: number;
  page_size: number;
  total: number;
}

/** 通用列表响应（部分接口字段名为 list 或 result，需在调用层适配） */
export interface CloudListResponse<T> {
  list?: T[];
  result?: T[];
  entities?: Record<string, unknown>;
  pager?: CloudPager;
  pagination?: { page: number; pageSize: number; total: number };
}

/** 后端统一错误响应 */
export interface CloudErrorResponse {
  /** 4xxxxxxx / 5xxxxxxx */
  code: number;
  message: string;
  /** session / account / lyric / live_slicer ... */
  type?: string;
  payload?: unknown;
}
