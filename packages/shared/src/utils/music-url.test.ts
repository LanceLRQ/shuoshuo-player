import { fetchMusicUrl, invalidateMusicUrlCache } from './music-url';
import { AUDIO_QUALITY } from '../constants';
import { useRiskControlStore } from '../store/risk-control';
import { useMusicUrlCacheStore } from '../store/music-url-cache';
import { useBilibiliVideosStore } from '../store/bilibili-videos';
import { usePlayerProfileStore } from '../store/player-profile';

vi.mock('../api', async () => {
  return {
    VideoApi: {
      getVideoViewInfo: vi.fn(),
      getVideoPlayurl: vi.fn(),
      doClickStat: vi.fn().mockResolvedValue({}),
    },
  };
});

// 在 mock 已注册后再 import，确保 music-url 内部拿到的是 mock
const { VideoApi } = await import('../api');
const mockedView = VideoApi.getVideoViewInfo as unknown as ReturnType<typeof vi.fn>;
const mockedPlay = VideoApi.getVideoPlayurl as unknown as ReturnType<typeof vi.fn>;
const mockedClick = VideoApi.doClickStat as unknown as ReturnType<typeof vi.fn>;

const audioStream = (id: number, baseUrl = `https://cdn.example.com/q${id}.m4s`) => ({
  id,
  base_url: baseUrl,
  backup_url: [],
});

describe('A7: fetchMusicUrl 音质降级链', () => {
  beforeEach(() => {
    mockedView.mockReset().mockResolvedValue({ aid: 100, cid: 200, bvid: 'BV1', desc_v2: [] });
    mockedPlay.mockReset();
    mockedClick.mockReset().mockResolvedValue({});
    // 重置持久化 URL 缓存与视频 entity store，避免用例间 cid 残留
    useMusicUrlCacheStore.setState({ entries: {} });
    useBilibiliVideosStore.setState({ ids: [], entities: {} });
  });

  it('优先选 192K（HIGH）', async () => {
    mockedPlay.mockResolvedValueOnce({
      dash: {
        audio: [
          audioStream(AUDIO_QUALITY.LOW),
          audioStream(AUDIO_QUALITY.MEDIUM),
          audioStream(AUDIO_QUALITY.HIGH),
        ],
      },
    });

    const url = await fetchMusicUrl('BV_HIGH', 999);
    expect(url).toContain(`q${AUDIO_QUALITY.HIGH}`);
  });

  it('缺 192K 时降级到 132K（MEDIUM）', async () => {
    mockedPlay.mockResolvedValueOnce({
      dash: {
        audio: [audioStream(AUDIO_QUALITY.LOW), audioStream(AUDIO_QUALITY.MEDIUM)],
      },
    });

    const url = await fetchMusicUrl('BV_MED', 999);
    expect(url).toContain(`q${AUDIO_QUALITY.MEDIUM}`);
  });

  it('仅有 64K 时降级到 LOW', async () => {
    mockedPlay.mockResolvedValueOnce({
      dash: {
        audio: [audioStream(AUDIO_QUALITY.LOW)],
      },
    });

    const url = await fetchMusicUrl('BV_LOW', 999);
    expect(url).toContain(`q${AUDIO_QUALITY.LOW}`);
  });

  it('音频列表为空时返回空字符串', async () => {
    mockedPlay.mockResolvedValueOnce({ dash: { audio: [] } });
    const url = await fetchMusicUrl('BV_NONE', 999);
    expect(url).toBe('');
  });

  it('过滤 https://xy 代理 URL，优先选 base_url', async () => {
    mockedPlay.mockResolvedValueOnce({
      dash: {
        audio: [
          {
            id: AUDIO_QUALITY.HIGH,
            base_url: 'https://xy-proxy.example.com/a.m4s',
            backup_url: ['https://cdn.example.com/backup.m4s'],
          },
        ],
      },
    });

    const url = await fetchMusicUrl('BV_XY', 999);
    expect(url).toBe('https://cdn.example.com/backup.m4s');
  });

  it('1 小时内同 BVID 命中缓存，不重复请求', async () => {
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    const url1 = await fetchMusicUrl('BV_CACHE', 1);
    const url2 = await fetchMusicUrl('BV_CACHE', 1);

    expect(url1).toBe(url2);
    expect(mockedView).toHaveBeenCalledTimes(1);
    expect(mockedPlay).toHaveBeenCalledTimes(1);
  });

  it('请求失败（throw）时返回空字符串且不抛出', async () => {
    mockedView.mockRejectedValueOnce(new Error('network'));
    const url = await fetchMusicUrl('BV_FAIL', 999);
    expect(url).toBe('');
  });

  it('playurl 返回 v_voucher 风控：触发 useRiskControlStore.openRiskControl 并返回空字符串', async () => {
    useRiskControlStore.setState({ open: false, voucher: null, bvid: null });
    mockedPlay.mockResolvedValueOnce({
      v_voucher: 'voucher_test_uuid_123',
    });

    const url = await fetchMusicUrl('BV_RISK', 999);

    expect(url).toBe('');
    const s = useRiskControlStore.getState();
    expect(s.open).toBe(true);
    expect(s.voucher).toBe('voucher_test_uuid_123');
    expect(s.bvid).toBe('BV_RISK');
  });

  it('invalidateMusicUrlCache(bvid)：清除缓存后下次调用重新请求', async () => {
    mockedView.mockResolvedValue({ aid: 1, cid: 2, bvid: 'BV_INV', desc_v2: [] });
    mockedPlay.mockResolvedValue({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    await fetchMusicUrl('BV_INV', 1);
    expect(mockedPlay).toHaveBeenCalledTimes(1);

    // 命中缓存：第二次不请求
    await fetchMusicUrl('BV_INV', 1);
    expect(mockedPlay).toHaveBeenCalledTimes(1);

    // 失效缓存：第三次重新请求
    invalidateMusicUrlCache('BV_INV');
    await fetchMusicUrl('BV_INV', 1);
    expect(mockedPlay).toHaveBeenCalledTimes(2);
  });

  it('cid 已存在 bili_videos store 中（mapViewItem 拾取）：跳过 view', async () => {
    useBilibiliVideosStore.setState({
      ids: ['BV_VS_CACHE'],
      entities: {
        BV_VS_CACHE: {
          aid: 0,
          bvid: 'BV_VS_CACHE',
          created: 0,
          length: '',
          pic: '',
          is_union_video: false,
          title: '',
          sub_title: '',
          play: 0,
          comment: 0,
          author: '',
          description: '',
          cid: 9999,
        },
      },
    });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    await fetchMusicUrl('BV_VS_CACHE', 1);

    expect(mockedView).not.toHaveBeenCalled();
    const callParams = (mockedPlay.mock.calls[0]?.[0] ?? {}) as {
      params?: { cid?: number };
    };
    expect(callParams.params?.cid).toBe(9999);
  });

  it('成功后写入持久化 URL 缓存（key=bvid:cid，value 不再含 cid）', async () => {
    mockedView.mockResolvedValueOnce({ aid: 1, cid: 200, bvid: 'BV_PERSIST', desc_v2: [] });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH, 'https://cdn.example.com/ok.m4s')] },
    });

    await fetchMusicUrl('BV_PERSIST', 1);

    const entry = useMusicUrlCacheStore.getState().entries['BV_PERSIST:200'];
    expect(entry?.playUrl).toBe('https://cdn.example.com/ok.m4s');
    expect(entry?.last_update).toBeGreaterThan(0);
    // 旧 key 形态（仅 bvid）不应存在
    expect(useMusicUrlCacheStore.getState().entries['BV_PERSIST']).toBeUndefined();
  });

  it('view→playurl 之间无人为 jitter 延迟（<= 50ms）', async () => {
    mockedView.mockResolvedValueOnce({ aid: 1, cid: 1, bvid: 'BV_NO_JITTER', desc_v2: [] });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    const start = performance.now();
    await fetchMusicUrl('BV_NO_JITTER', 1);
    const elapsed = performance.now() - start;

    // v1 早期版本会插入 200-500ms 随机延迟；当前实现移除后两次 mock API 总和应远低于 50ms
    expect(elapsed).toBeLessThan(50);
  });
});

describe('B1: fetchMusicUrl page 参数（分 P 支持）', () => {
  beforeEach(() => {
    mockedView.mockReset();
    mockedPlay.mockReset();
    mockedClick.mockReset().mockResolvedValue({});
    useMusicUrlCacheStore.setState({ entries: {} });
    useBilibiliVideosStore.setState({ ids: [], entities: {} });
  });

  it('多 P 投稿请求 page=2：playurl 拿到第 2 P 的 cid', async () => {
    mockedView.mockResolvedValueOnce({
      aid: 100,
      cid: 1000,
      bvid: 'BV_MULTI',
      desc_v2: [],
      videos: 3,
      pages: [
        { cid: 1000, page: 1, part: 'P1', duration: 60 },
        { cid: 1001, page: 2, part: 'P2', duration: 90 },
        { cid: 1002, page: 3, part: 'P3', duration: 30 },
      ],
    });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    await fetchMusicUrl('BV_MULTI', 1, 0, undefined, 2);

    const callParams = (mockedPlay.mock.calls[0]?.[0] ?? {}) as { params?: { cid?: number } };
    expect(callParams.params?.cid).toBe(1001);
    // 写入 cache 时 key 为 bvid:cid（不是 bvid）
    expect(useMusicUrlCacheStore.getState().entries['BV_MULTI:1001']?.playUrl).toBeTruthy();
  });

  it('多 P 投稿请求 page=3：直接从 store.pages 拿 cid，跳过 view', async () => {
    useBilibiliVideosStore.setState({
      ids: ['BV_HAS_PAGES'],
      entities: {
        BV_HAS_PAGES: {
          aid: 1,
          bvid: 'BV_HAS_PAGES',
          created: 0,
          length: '',
          pic: '',
          is_union_video: false,
          title: '',
          sub_title: '',
          play: 0,
          comment: 0,
          author: '',
          description: '',
          videos: 3,
          pages: [
            { cid: 2000, page: 1, part: '', duration: 0 },
            { cid: 2001, page: 2, part: '', duration: 0 },
            { cid: 2002, page: 3, part: '', duration: 0 },
          ],
        },
      },
    });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    await fetchMusicUrl('BV_HAS_PAGES', 1, 0, undefined, 3);

    expect(mockedView).not.toHaveBeenCalled();
    const callParams = (mockedPlay.mock.calls[0]?.[0] ?? {}) as { params?: { cid?: number } };
    expect(callParams.params?.cid).toBe(2002);
  });

  it('同 bvid 不同 page 的 cache 互不覆盖', async () => {
    mockedView.mockResolvedValue({
      aid: 1,
      cid: 5000,
      bvid: 'BV_ISO',
      desc_v2: [],
      videos: 2,
      pages: [
        { cid: 5000, page: 1, part: '', duration: 0 },
        { cid: 5001, page: 2, part: '', duration: 0 },
      ],
    });
    mockedPlay
      .mockResolvedValueOnce({
        dash: { audio: [audioStream(AUDIO_QUALITY.HIGH, 'https://cdn/p1.m4s')] },
      })
      .mockResolvedValueOnce({
        dash: { audio: [audioStream(AUDIO_QUALITY.HIGH, 'https://cdn/p2.m4s')] },
      });

    const u1 = await fetchMusicUrl('BV_ISO', 1, 0, undefined, 1);
    const u2 = await fetchMusicUrl('BV_ISO', 1, 0, undefined, 2);

    expect(u1).toBe('https://cdn/p1.m4s');
    expect(u2).toBe('https://cdn/p2.m4s');
    expect(useMusicUrlCacheStore.getState().entries['BV_ISO:5000']?.playUrl).toBe(
      'https://cdn/p1.m4s',
    );
    expect(useMusicUrlCacheStore.getState().entries['BV_ISO:5001']?.playUrl).toBe(
      'https://cdn/p2.m4s',
    );
  });

  it('page 非法（0 / 负数 / 非整数）→ 视为 1', async () => {
    mockedView.mockResolvedValueOnce({
      aid: 1,
      cid: 999,
      bvid: 'BV_BAD_PAGE',
      desc_v2: [],
    });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    await fetchMusicUrl('BV_BAD_PAGE', 1, 0, undefined, 0);

    const callParams = (mockedPlay.mock.calls[0]?.[0] ?? {}) as { params?: { cid?: number } };
    expect(callParams.params?.cid).toBe(999);
  });

  it('clickStat 上报 part 为 effective page', async () => {
    vi.useFakeTimers();
    mockedView.mockResolvedValueOnce({
      aid: 7,
      cid: 70,
      bvid: 'BV_CLICK',
      desc_v2: [],
      videos: 2,
      pages: [
        { cid: 70, page: 1, part: '', duration: 0 },
        { cid: 71, page: 2, part: '', duration: 0 },
      ],
    });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    await fetchMusicUrl('BV_CLICK', 999, 0, undefined, 2);
    // 触发 setTimeout 内的 clickStat
    await vi.advanceTimersByTimeAsync(2000);

    expect(mockedClick).toHaveBeenCalled();
    const clickArgs = (mockedClick.mock.calls[0]?.[0] ?? {}) as {
      params?: { w_part?: number };
      data?: { part?: string };
    };
    expect(clickArgs.params?.w_part).toBe(2);
    expect(clickArgs.data?.part).toBe('2');
    vi.useRealTimers();
  });
});

describe('默认音质偏好挑流（含大会员档 + fnval 推导）', () => {
  // 含全部音质的 playInfo：常规三档 + 杜比 + Hi-Res
  const fullDash = () => ({
    dash: {
      audio: [
        audioStream(AUDIO_QUALITY.LOW),
        audioStream(AUDIO_QUALITY.MEDIUM),
        audioStream(AUDIO_QUALITY.HIGH),
      ],
      dolby: { type: 2, audio: [audioStream(AUDIO_QUALITY.DOLBY)] },
      flac: { display: true, audio: audioStream(AUDIO_QUALITY.HIRES) },
    },
  });

  const fnvalOf = (callIndex = 0): number | undefined =>
    ((mockedPlay.mock.calls[callIndex]?.[0] ?? {}) as { params?: { fnval?: number } }).params
      ?.fnval;

  beforeEach(() => {
    mockedView.mockReset().mockResolvedValue({ aid: 1, cid: 2, bvid: 'BVQ', desc_v2: [] });
    mockedPlay.mockReset();
    mockedClick.mockReset().mockResolvedValue({});
    useMusicUrlCacheStore.setState({ entries: {} });
    useBilibiliVideosStore.setState({ ids: [], entities: {} });
    usePlayerProfileStore.setState({ defaultAudioQuality: 'auto' });
  });

  it('auto + 视频有 Hi-Res：选 Hi-Res，fnval=4048', async () => {
    usePlayerProfileStore.setState({ defaultAudioQuality: 'auto' });
    mockedPlay.mockResolvedValueOnce(fullDash());
    const url = await fetchMusicUrl('BV_AUTO_HR', 1);
    expect(url).toContain(`q${AUDIO_QUALITY.HIRES}`);
    expect(fnvalOf()).toBe(4048);
  });

  it('dolby 偏好 + 视频有杜比：选杜比，fnval=4048', async () => {
    usePlayerProfileStore.setState({ defaultAudioQuality: 'dolby' });
    mockedPlay.mockResolvedValueOnce(fullDash());
    const url = await fetchMusicUrl('BV_DOLBY', 1);
    expect(url).toContain(`q${AUDIO_QUALITY.DOLBY}`);
    expect(fnvalOf()).toBe(4048);
  });

  it('hires 偏好但视频无无损：降级到 192K', async () => {
    usePlayerProfileStore.setState({ defaultAudioQuality: 'hires' });
    mockedPlay.mockResolvedValueOnce({
      dash: {
        audio: [audioStream(AUDIO_QUALITY.MEDIUM), audioStream(AUDIO_QUALITY.HIGH)],
        dolby: { type: 0, audio: null },
        flac: null,
      },
    });
    const url = await fetchMusicUrl('BV_HR_FALLBACK', 1);
    expect(url).toContain(`q${AUDIO_QUALITY.HIGH}`);
  });

  it('high 偏好：选 192K，fnval=16（不请求高保真流）', async () => {
    usePlayerProfileStore.setState({ defaultAudioQuality: 'high' });
    mockedPlay.mockResolvedValueOnce(fullDash());
    const url = await fetchMusicUrl('BV_HIGH_PREF', 1);
    expect(url).toContain(`q${AUDIO_QUALITY.HIGH}`);
    expect(fnvalOf()).toBe(16);
  });

  it('low 偏好：选 64K，fnval=16', async () => {
    usePlayerProfileStore.setState({ defaultAudioQuality: 'low' });
    mockedPlay.mockResolvedValueOnce(fullDash());
    const url = await fetchMusicUrl('BV_LOW_PREF', 1);
    expect(url).toContain(`q${AUDIO_QUALITY.LOW}`);
    expect(fnvalOf()).toBe(16);
  });

  it('attempt=1 降级：即使偏好 auto 也跳过高保真选 132K，fnval=16', async () => {
    usePlayerProfileStore.setState({ defaultAudioQuality: 'auto' });
    mockedPlay.mockResolvedValueOnce(fullDash());
    const url = await fetchMusicUrl('BV_ATTEMPT1', 1, 1);
    expect(url).toContain(`q${AUDIO_QUALITY.MEDIUM}`);
    expect(fnvalOf()).toBe(16);
  });

  it('medium 偏好 + 视频仅有 Hi-Res/64K：降级到 64K', async () => {
    usePlayerProfileStore.setState({ defaultAudioQuality: 'medium' });
    mockedPlay.mockResolvedValueOnce({
      dash: {
        audio: [audioStream(AUDIO_QUALITY.LOW)],
        flac: { display: true, audio: audioStream(AUDIO_QUALITY.HIRES) },
      },
    });
    const url = await fetchMusicUrl('BV_MED_FALLBACK', 1);
    expect(url).toContain(`q${AUDIO_QUALITY.LOW}`);
  });
});
