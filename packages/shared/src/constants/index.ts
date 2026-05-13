import { CloudServiceUserRole } from '../types';

export { FavListType } from '../types';

/** 需要持久化的 store key（对齐 v1 constants.js → persistKeys） */
export const PERSIST_KEYS = [
  'bili_user_videos',
  'bili_videos',
  'playing_list',
  'fav_list',
  'ui_profile',
  'lyrics',
  'cloud_service',
  'music_url_cache',
  'update_checker',
  'favorites',
  'video_page_pref',
] as const;

/** 可导出的 store key（cloud_service 出于安全不导出） */
export const EXPORT_KEYS = [
  'bili_user_videos',
  'bili_videos',
  'playing_list',
  'fav_list',
  'ui_profile',
  'lyrics',
  'favorites',
  'video_page_pref',
] as const;

/** 主 UP 主信息 */
export const MASTER_UP_INFO = {
  uname: '说说Crystal',
  nickname: '说说',
  mid: 283886865,
} as const;

/** 通知类型 */
export enum NoticeType {
  INFO = 0,
  WARN = 1,
  ERROR = 2,
  SUCCESS = 3,
}

/** 启动加载提示语（对齐 v1 StartupLoadingTip） */
export const STARTUP_LOADING_TIPS = [
  '喝海带汤',
  '打破游戏',
  '录歌',
  '学羊叫',
  '植物大战僵尸',
  '玩俄罗斯方块',
  '不听话',
  '蜀道山',
] as const;

/** 云服务角色名称映射 */
export const CLOUD_SERVICE_ROLE_NAME_MAP: Record<number, string> = {
  [CloudServiceUserRole.WebMaster]: '站长',
  [CloudServiceUserRole.Admin]: '管理员',
  [CloudServiceUserRole.User]: '水晶蟹',
};

/** 默认分页大小（对齐 v1 CommonPageLimitSize） */
export const DEFAULT_PAGE_SIZE = 20;

/** 默认分页请求参数（page+limit 模式，对齐新版后端） */
export const DEFAULT_PAGER_PARAMS = { page: 1, limit: DEFAULT_PAGE_SIZE } as const;

/** 默认分页响应初始值（page+page_size+total 模式） */
export const DEFAULT_PAGER_OBJECT = { page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0 } as const;

/** 音乐 URL 缓存 TTL（秒） */
export const MUSIC_URL_CACHE_TTL = 3600;

/** 点击统计节流时间（秒，v1 注释为 5 分钟实际为 600s） */
export const CLICK_STAT_THROTTLE = 600;

/** 模拟点击延迟（毫秒，v1 是 setTimeout 500ms 后再发起） */
export const CLICK_STAT_DELAY_MS = 500;

/** 持久化节流时间（毫秒） */
export const PERSIST_THROTTLE_MS = 1000;

/** 视频列表自动刷新阈值（秒，超过则提示更新；24 小时） */
export const VIDEO_LIST_REFRESH_THRESHOLD = 86400;

/** B 站空间信息字段拾取 */
export const BILIBILI_SPACE_INFO_FIELDS = [
  'name',
  'mid',
  'face',
  'sign',
  'sex',
  'tags',
  'top_photo',
] as const;

/** 音频品质 ID 映射（B 站 DASH 音频流） */
export const AUDIO_QUALITY = {
  /** 192 Kbps */
  HIGH: 30280,
  /** 132 Kbps */
  MEDIUM: 30232,
  /** 64 Kbps */
  LOW: 30216,
} as const;

/** 云服务 API 默认 baseURL（用户未在设置中覆盖时 fallback） */
export const DEFAULT_CLOUD_API_BASE_URL = 'https://shuoshuo.sikong.ren/api';

/**
 * v2 storage key 命名空间前缀（**S**huoshuo**S**huo**P**layer **v2**）
 *
 * 所有 v2 自有持久化 key 都用此前缀，与 v1 老 key（fav_list / lyrics 等裸名）完全隔离；
 * 未来 v3 升级可平行使用 `ssp_v3_`，便于多版本共存测试。
 *
 * 注意：Rust 端 (packages/desktop/src-tauri/src/commands/store.rs) 的 ALLOWED_KEYS
 * 与本前缀拼接结果手动同步；改动时务必同步修改两边。
 */
export const SSP_V2_NAMESPACE = 'ssp_v2_';

/** 用户自定义 baseURL 在 storage 中的 key */
export const CLOUD_API_BASE_URL_STORAGE_KEY = `${SSP_V2_NAMESPACE}cloud_api_base_url`;

/** 撤销栈最大深度（歌词编辑器，对齐 v1 行为） */
export const LYRIC_EDITOR_UNDO_STACK_MAX = 999;

/**
 * 视频搜索结果硬上限：对齐 B 站 search/type 接口官方上限
 * （numResults ≤ 1000，numPages ≤ 50，每页 20 条）
 */
export const VIDEO_SEARCH_RESULT_HARD_LIMIT = 1000;

/**
 * 触发会话失效的后端错误码集合
 * client.ts / cloud-service store / phase-7 测试统一引用此常量
 */
export const SESSION_EXPIRED_ERROR_CODES = [
  /** 登录信息失效 */
  4010000 /** token 为空 */, 4010001 /** 当前角色无权限 */, 4010003 /** 账号已被封禁 */, 4010006,
] as const;
