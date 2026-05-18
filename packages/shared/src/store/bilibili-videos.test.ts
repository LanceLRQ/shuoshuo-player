import { useBilibiliVideosStore } from './bilibili-videos';
import type { BilibiliVideo } from '../types';

function makeVideo(bvid: string, created: number, title = ''): BilibiliVideo {
  return {
    aid: 1,
    bvid,
    created,
    length: '00:01',
    pic: '',
    is_union_video: false,
    title,
    sub_title: '',
    play: 0,
    comment: 0,
    author: '',
    description: '',
    mid: 1,
  };
}

function reset() {
  useBilibiliVideosStore.setState({ ids: [], entities: {} });
}

describe('useBilibiliVideosStore', () => {
  beforeEach(reset);

  it('upsertMany 新增多个视频并按 created 倒序', () => {
    useBilibiliVideosStore
      .getState()
      .upsertMany([makeVideo('BV1', 100), makeVideo('BV2', 300), makeVideo('BV3', 200)]);
    expect(useBilibiliVideosStore.getState().ids).toEqual(['BV2', 'BV3', 'BV1']);
  });

  it('upsertMany 部分字段更新（merge）', () => {
    useBilibiliVideosStore.getState().upsertMany([makeVideo('BV1', 100, 'old title')]);
    useBilibiliVideosStore
      .getState()
      .upsertMany([{ bvid: 'BV1', title: 'new title' } as BilibiliVideo]);
    const entity = useBilibiliVideosStore.getState().entities.BV1;
    expect(entity.title).toBe('new title');
    expect(entity.created).toBe(100);
  });

  it('getByBvid 返回对应视频或 undefined', () => {
    useBilibiliVideosStore.getState().upsertMany([makeVideo('BV1', 0)]);
    expect(useBilibiliVideosStore.getState().getByBvid('BV1')).toMatchObject({ bvid: 'BV1' });
    expect(useBilibiliVideosStore.getState().getByBvid('missing')).toBeUndefined();
  });

  it('getOrderedAll 按 ids 顺序返回视频列表', () => {
    useBilibiliVideosStore
      .getState()
      .upsertMany([makeVideo('BV1', 100), makeVideo('BV2', 300), makeVideo('BV3', 200)]);
    const list = useBilibiliVideosStore.getState().getOrderedAll();
    expect(list.map((v) => v.bvid)).toEqual(['BV2', 'BV3', 'BV1']);
  });

  it('upsertMany 缺失 created 字段视为 0（最末位）', () => {
    useBilibiliVideosStore
      .getState()
      .upsertMany([
        { bvid: 'BV1', created: 100 } as BilibiliVideo,
        { bvid: 'BV2' } as BilibiliVideo,
      ]);
    expect(useBilibiliVideosStore.getState().ids).toEqual(['BV1', 'BV2']);
  });

  describe('失效标记（invalid）', () => {
    it('upsertMany 在 patch 未带 invalid 时保留旧 invalid=true（防止重拉覆盖）', () => {
      useBilibiliVideosStore.getState().upsertMany([{ ...makeVideo('BV1', 100), invalid: true }]);
      useBilibiliVideosStore.getState().upsertMany([{ bvid: 'BV1', title: '改了标题' }]);
      const e = useBilibiliVideosStore.getState().entities.BV1;
      expect(e.invalid).toBe(true);
      expect(e.title).toBe('改了标题');
    });

    it('upsertMany 显式 invalid=false 可恢复有效状态', () => {
      useBilibiliVideosStore.getState().upsertMany([{ ...makeVideo('BV1', 100), invalid: true }]);
      useBilibiliVideosStore.getState().upsertMany([{ bvid: 'BV1', invalid: false }]);
      expect(useBilibiliVideosStore.getState().entities.BV1.invalid).toBe(false);
    });

    it('markVideosInvalid 把指定 bvid 标记为 invalid', () => {
      useBilibiliVideosStore
        .getState()
        .upsertMany([makeVideo('BV1', 100), makeVideo('BV2', 200), makeVideo('BV3', 300)]);
      useBilibiliVideosStore.getState().markVideosInvalid(['BV1', 'BV3']);
      const { entities } = useBilibiliVideosStore.getState();
      expect(entities.BV1.invalid).toBe(true);
      expect(entities.BV2.invalid).toBeUndefined();
      expect(entities.BV3.invalid).toBe(true);
    });

    it('markVideosInvalid 不存在的 bvid 静默忽略，不创建空 entity', () => {
      useBilibiliVideosStore.getState().upsertMany([makeVideo('BV1', 100)]);
      useBilibiliVideosStore.getState().markVideosInvalid(['BV_NOT_EXIST']);
      expect(useBilibiliVideosStore.getState().entities.BV_NOT_EXIST).toBeUndefined();
      expect(useBilibiliVideosStore.getState().ids).toEqual(['BV1']);
    });

    it('markVideosInvalid 已 invalid 的 bvid 不触发 state 变化（引用稳定）', () => {
      useBilibiliVideosStore.getState().upsertMany([{ ...makeVideo('BV1', 100), invalid: true }]);
      const before = useBilibiliVideosStore.getState().entities;
      useBilibiliVideosStore.getState().markVideosInvalid(['BV1']);
      expect(useBilibiliVideosStore.getState().entities).toBe(before);
    });
  });
});
