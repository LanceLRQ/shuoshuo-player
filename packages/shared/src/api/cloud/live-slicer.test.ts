import { LiveSlicerApi } from './live-slicer';
import { cloudPure } from '../client';

describe('B5: LiveSlicerApi mid 字符串字段', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(cloudPure, 'request').mockResolvedValue({
      data: { code: 0, data: { id: 1, mid: '99999999999999999999' } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publicList 走 GET /live_slicer_men/list', async () => {
    await LiveSlicerApi.publicList({ page: 1, limit: 20 });
    expect(spy.mock.calls[0][0].url).toBe('/live_slicer_men/list');
    expect(spy.mock.calls[0][0].params).toEqual({ page: 1, limit: 20 });
  });

  it('manageList 走 GET /live_slicer_men/manage/list', async () => {
    await LiveSlicerApi.manageList();
    expect(spy.mock.calls[0][0].url).toBe('/live_slicer_men/manage/list');
  });

  it('create 透传超大 UID 字符串（不被 Number 截断）', async () => {
    const bigMid = '99999999999999999999'; // 超过 Number.MAX_SAFE_INTEGER
    await LiveSlicerApi.create({ mid: bigMid, name: 't' });
    const cfg = spy.mock.calls[0][0];
    expect(cfg.url).toBe('/live_slicer_men/manage/new');
    expect(cfg.method).toBe('post');
    expect((cfg.data as { mid: string }).mid).toBe(bigMid);
    expect(typeof (cfg.data as { mid: unknown }).mid).toBe('string');
  });

  it('update 走 POST /live_slicer_men/manage/:id', async () => {
    await LiveSlicerApi.update(7, { mid: '12345', name: 'n' });
    expect(spy.mock.calls[0][0].url).toBe('/live_slicer_men/manage/7');
    expect(spy.mock.calls[0][0].method).toBe('post');
  });

  it('delete 走 DELETE /live_slicer_men/manage/:id', async () => {
    await LiveSlicerApi.delete(8);
    expect(spy.mock.calls[0][0].url).toBe('/live_slicer_men/manage/8');
    expect(spy.mock.calls[0][0].method).toBe('delete');
  });
});
