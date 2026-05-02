import { fetchMusicUrl } from './music-url';
import { AUDIO_QUALITY } from '../constants';

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
  baseUrl,
  backup_url: [],
});

describe('A7: fetchMusicUrl 音质降级链', () => {
  beforeEach(() => {
    mockedView.mockReset().mockResolvedValue({ aid: 100, cid: 200, bvid: 'BV1', desc_v2: [] });
    mockedPlay.mockReset();
    mockedClick.mockReset().mockResolvedValue({});
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

  it('过滤 https://xy 代理 URL，优先选 baseUrl', async () => {
    mockedPlay.mockResolvedValueOnce({
      dash: {
        audio: [
          {
            id: AUDIO_QUALITY.HIGH,
            baseUrl: 'https://xy-proxy.example.com/a.m4s',
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
});
