import { LyricApi } from './lyric';
import { cloudPure } from '../client';

/**
 * B3: 验证云服务歌词 API 的 URL 路径与字段名契约
 *  - 上传统一走 POST /lyric/manage/by-bvid/:bvid（upsert，bvid 寻址）
 *  - 删除/历史走数字 id 寻址 /lyric/manage/:id
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

  it('saveLyric 调用 POST /lyric/manage/by-bvid/:bvid，body 仅含 title/content', async () => {
    await LyricApi.saveLyric('BV1xxxxx', { title: 't', content: '[00:01]hi' });
    const cfg = spy.mock.calls[0][0];
    expect(cfg.url).toBe('/lyric/manage/by-bvid/BV1xxxxx');
    expect(cfg.method).toBe('post');
    expect(cfg.data).toMatchObject({ title: 't', content: '[00:01]hi' });
    // v2 与 v1 的关键差异：字段名 content 而非 lyric
    expect(cfg.data).not.toHaveProperty('lyric');
    // bvid 在 URL 寻址，不再出现在 body
    expect(cfg.data).not.toHaveProperty('bvid');
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
