import { LyricApi } from './lyric';
import { cloudPure } from '../client';

/**
 * B3: 验证云服务歌词 API 的 URL 路径与字段名契约
 *  - 创建走 /lyric/manage/new
 *  - 更新走 /lyric/manage/:id
 *  - 上传字段名为 content（v2 与 v1 的关键差异）
 */
describe('B3: 云服务 LyricApi 路径与字段', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(cloudPure, 'request').mockResolvedValue({
      data: { code: 0, data: { id: 1, bvid: 'BV1', content: 'L' } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createLyric 调用 POST /lyric/manage/new', async () => {
    await LyricApi.createLyric({ bvid: 'BV1xxxxx', content: '[00:01]hi' });
    const cfg = spy.mock.calls[0][0];
    expect(cfg.url).toBe('/lyric/manage/new');
    expect(cfg.method).toBe('post');
    expect(cfg.data).toMatchObject({ bvid: 'BV1xxxxx', content: '[00:01]hi' });
    // v2 与 v1 的关键差异：字段名 content 而非 lyric
    expect(cfg.data).not.toHaveProperty('lyric');
  });

  it('updateLyric(id) 调用 POST /lyric/manage/:id', async () => {
    await LyricApi.updateLyric(42, { content: '[00:02]new' });
    const cfg = spy.mock.calls[0][0];
    expect(cfg.url).toBe('/lyric/manage/42');
    expect(cfg.method).toBe('post');
    expect(cfg.data).toMatchObject({ content: '[00:02]new' });
  });

  it('getLyricByBvid 走公开端点 /lyric/:bvid', async () => {
    await LyricApi.getLyricByBvid('BV1abc');
    expect(spy.mock.calls[0][0].url).toBe('/lyric/BV1abc');
  });

  it('getLyricList 走 /lyric/manage/list 并传分页/搜索参数', async () => {
    await LyricApi.getLyricList({ page: 2, limit: 10, keyword: 'k' });
    const cfg = spy.mock.calls[0][0];
    expect(cfg.url).toBe('/lyric/manage/list');
    expect(cfg.params).toEqual({ page: 2, limit: 10, keyword: 'k' });
  });

  it('getLyricHistory 走 /lyric/manage/:id/snap', async () => {
    await LyricApi.getLyricHistory(7);
    expect(spy.mock.calls[0][0].url).toBe('/lyric/manage/7/snap');
  });

  it('deleteLyric 走 DELETE /lyric/manage/:id', async () => {
    await LyricApi.deleteLyric(9);
    expect(spy.mock.calls[0][0].url).toBe('/lyric/manage/9');
    expect(spy.mock.calls[0][0].method).toBe('delete');
  });
});
