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
    useBilibiliVideosStore.getState().upsertMany([
      makeVideo('BV1', 100),
      makeVideo('BV2', 300),
      makeVideo('BV3', 200),
    ]);
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
    useBilibiliVideosStore.getState().upsertMany([
      makeVideo('BV1', 100),
      makeVideo('BV2', 300),
      makeVideo('BV3', 200),
    ]);
    const list = useBilibiliVideosStore.getState().getOrderedAll();
    expect(list.map((v) => v.bvid)).toEqual(['BV2', 'BV3', 'BV1']);
  });

  it('upsertMany 缺失 created 字段视为 0（最末位）', () => {
    useBilibiliVideosStore.getState().upsertMany([
      { bvid: 'BV1', created: 100 } as BilibiliVideo,
      { bvid: 'BV2' } as BilibiliVideo,
    ]);
    expect(useBilibiliVideosStore.getState().ids).toEqual(['BV1', 'BV2']);
  });
});
