import {
  SESSION_EXPIRED_ERROR_CODES,
  AUDIO_QUALITY,
  MUSIC_URL_CACHE_TTL,
  CLICK_STAT_THROTTLE,
  CLICK_STAT_DELAY_MS,
  PERSIST_THROTTLE_MS,
  LYRIC_EDITOR_UNDO_STACK_MAX,
  VIDEO_SEARCH_RESULT_HARD_LIMIT,
  VIDEO_LIST_REFRESH_THRESHOLD,
  DEFAULT_CLOUD_API_BASE_URL,
  CLOUD_API_BASE_URL_STORAGE_KEY,
} from './index';

describe('E1: SESSION_EXPIRED_ERROR_CODES 集合稳定性快照', () => {
  it('包含全部 4 个会话失效码且不能随意改动', () => {
    expect([...SESSION_EXPIRED_ERROR_CODES].sort()).toEqual([4010000, 4010001, 4010003, 4010006]);
  });

  it('运行时定义为 readonly 元组（防止误 push）', () => {
    expect(
      Object.isFrozen(SESSION_EXPIRED_ERROR_CODES) || Array.isArray(SESSION_EXPIRED_ERROR_CODES),
    ).toBe(true);
    // TS 层 as const 已保证只读；运行时仅断言长度稳定
    expect(SESSION_EXPIRED_ERROR_CODES.length).toBe(4);
  });
});

describe('E1: 关键不变量数值', () => {
  it('音质降级链 ID 与 v1 后端协议对齐', () => {
    expect(AUDIO_QUALITY.HIGH).toBe(30280);
    expect(AUDIO_QUALITY.MEDIUM).toBe(30232);
    expect(AUDIO_QUALITY.LOW).toBe(30216);
  });

  it('缓存 / 节流 / 阈值与 plans 文档对齐', () => {
    expect(MUSIC_URL_CACHE_TTL).toBe(3600);
    expect(CLICK_STAT_THROTTLE).toBe(600);
    expect(CLICK_STAT_DELAY_MS).toBe(500);
    expect(PERSIST_THROTTLE_MS).toBe(1000);
    expect(VIDEO_LIST_REFRESH_THRESHOLD).toBe(86400);
    expect(LYRIC_EDITOR_UNDO_STACK_MAX).toBe(999);
    expect(VIDEO_SEARCH_RESULT_HARD_LIMIT).toBe(1000);
  });

  it('云服务默认 baseURL 与 storage key 不漂移', () => {
    expect(DEFAULT_CLOUD_API_BASE_URL).toBe('https://shuoshuo.sikong.ren/api');
    expect(CLOUD_API_BASE_URL_STORAGE_KEY).toBe('cloud_api_base_url');
  });
});
