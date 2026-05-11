import { fetchMusicUrl, invalidateMusicUrlCache } from './music-url';
import { AUDIO_QUALITY } from '../constants';
import { useRiskControlStore } from '../store/risk-control';
import { useMusicUrlCacheStore } from '../store/music-url-cache';
import { useBilibiliVideosStore } from '../store/bilibili-videos';

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

  it('cid 已存在 URL 缓存中：跳过 view 接口，直接调 playurl', async () => {
    // 预置一条命中 cid 但 playUrl 已无效（last_update 设为 0 让 getValid 返回 undefined）的条目
    useMusicUrlCacheStore.setState({
      entries: {
        BV_CID_CACHE: { playUrl: '', cid: 4242, last_update: 0 },
      },
    });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH)] },
    });

    await fetchMusicUrl('BV_CID_CACHE', 1);

    // view 必须没被调；playurl 接口收到的 cid 来自 store
    expect(mockedView).not.toHaveBeenCalled();
    expect(mockedPlay).toHaveBeenCalledTimes(1);
    const callParams = (mockedPlay.mock.calls[0]?.[0] ?? {}) as {
      params?: { cid?: number };
    };
    expect(callParams.params?.cid).toBe(4242);
  });

  it('cid 已存在 bili_videos store 中（mapViewItem 拾取）：同样跳过 view', async () => {
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

  it('成功后写入持久化 URL 缓存，且包含 cid', async () => {
    mockedView.mockResolvedValueOnce({ aid: 1, cid: 200, bvid: 'BV_PERSIST', desc_v2: [] });
    mockedPlay.mockResolvedValueOnce({
      dash: { audio: [audioStream(AUDIO_QUALITY.HIGH, 'https://cdn.example.com/ok.m4s')] },
    });

    await fetchMusicUrl('BV_PERSIST', 1);

    const entry = useMusicUrlCacheStore.getState().entries['BV_PERSIST'];
    expect(entry?.playUrl).toBe('https://cdn.example.com/ok.m4s');
    expect(entry?.cid).toBe(200);
    expect(entry?.last_update).toBeGreaterThan(0);
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
