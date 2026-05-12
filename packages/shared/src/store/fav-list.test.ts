import { describe, it, expect, beforeEach } from 'vitest';
import { useFavListStore } from './fav-list';
import { FavListType } from '../types';

function makeFav(type: FavListType, mid?: string) {
  return useFavListStore.getState().addFavList({
    name: 'test',
    type,
    bv_ids: [],
    ...(mid ? { mid } : {}),
  })!;
}

describe('useFavListStore（E1/E2 TrackId 校验）', () => {
  beforeEach(() => {
    useFavListStore.setState({ list: [] });
  });

  describe('addFavVideo', () => {
    it('CUSTOM 接受纯 bvid', () => {
      const fav = makeFav(FavListType.CUSTOM);
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx');
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual(['BV1aB4y1k7Yx']);
    });

    it('CUSTOM 接受合法 bvid:p<n>', () => {
      const fav = makeFav(FavListType.CUSTOM);
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx:p3');
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual(['BV1aB4y1k7Yx:p3']);
    });

    it('CUSTOM 拒绝非法 TrackId（如 av 格式 / 杂字符串）', () => {
      const fav = makeFav(FavListType.CUSTOM);
      useFavListStore.getState().addFavVideo(fav.id, 'av12345');
      useFavListStore.getState().addFavVideo(fav.id, 'garbage');
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx:p1');
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual([]);
    });

    it('UPLOADER 类型永远不写入（已有 type 检查兜底）', () => {
      const fav = makeFav(FavListType.UPLOADER, '100001');
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx');
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual([]);
    });

    it('同 trackId 不重复', () => {
      const fav = makeFav(FavListType.CUSTOM);
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx');
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx');
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual(['BV1aB4y1k7Yx']);
    });

    it('bvid 与 bvid:p<n> 视为不同 TrackId 并存', () => {
      const fav = makeFav(FavListType.CUSTOM);
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx');
      useFavListStore.getState().addFavVideo(fav.id, 'BV1aB4y1k7Yx:p2');
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual(['BV1aB4y1k7Yx', 'BV1aB4y1k7Yx:p2']);
    });
  });

  describe('batchAddFavVideos', () => {
    it('CUSTOM 过滤非法 TrackId，保留合法 trackId', () => {
      const fav = makeFav(FavListType.CUSTOM);
      useFavListStore
        .getState()
        .batchAddFavVideos(fav.id, ['BV1', 'BV2:p3', 'av99', 'BV3:p1', 'BV4']);
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      // 'av99' 非 BV 前缀拒绝；'BV3:p1' 冗余表达拒绝
      expect(after?.bv_ids).toEqual(['BV1', 'BV2:p3', 'BV4']);
    });

    it('UPLOADER 类型 batch 入参全部被忽略', () => {
      const fav = makeFav(FavListType.UPLOADER, '100001');
      useFavListStore.getState().batchAddFavVideos(fav.id, ['BV1', 'BV2']);
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual([]);
    });
  });

  describe('removeFavVideo', () => {
    it('删除 TrackId 条目（纯 bvid 与 :p<n> 视为不同 key）', () => {
      const fav = makeFav(FavListType.CUSTOM);
      useFavListStore.getState().batchAddFavVideos(fav.id, ['BV1aB4y1k7Yx', 'BV1aB4y1k7Yx:p2']);
      useFavListStore.getState().removeFavVideo(fav.id, 'BV1aB4y1k7Yx:p2');
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual(['BV1aB4y1k7Yx']);
    });
  });
});
