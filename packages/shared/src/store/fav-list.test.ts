import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFavListStore } from './fav-list';
import { useBilibiliUserVideosStore } from './bilibili-user-videos';
import { useBilibiliVideosStore } from './bilibili-videos';
import { FavListType, type BilibiliVideo } from '../types';

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
    // 复位 entity store，避免上一用例预热的缓存影响"view 调用次数"断言
    useBilibiliVideosStore.setState({ ids: [], entities: {} });
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

  describe('addFavVideoByBvids（多 P 批量回归）', () => {
    it('同 bvid 的多 P TrackId：view 接口仅调一次，全部 P 都写入歌单', async () => {
      const fav = makeFav(FavListType.CUSTOM);
      const getVideoByBvid = vi.fn(async () => true);
      useBilibiliUserVideosStore.setState({ getVideoByBvid });

      const result = await useFavListStore
        .getState()
        .addFavVideoByBvids(fav.id, [
          'BV1aB4y1k7Yx',
          'BV1aB4y1k7Yx:p2',
          'BV1aB4y1k7Yx:p3',
          'BV1aB4y1k7Yx:p4',
        ]);

      // bug 修复关键断言：view 调用 1 次而非 4 次（避免限流后只有首条成功）
      expect(getVideoByBvid).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(4);
      expect(result.failed).toBe(0);
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual([
        'BV1aB4y1k7Yx',
        'BV1aB4y1k7Yx:p2',
        'BV1aB4y1k7Yx:p3',
        'BV1aB4y1k7Yx:p4',
      ]);
    });

    it('view 接口失败时该 bvid 的所有 P 都计 failed', async () => {
      const fav = makeFav(FavListType.CUSTOM);
      useBilibiliUserVideosStore.setState({ getVideoByBvid: vi.fn(async () => false) });

      const result = await useFavListStore
        .getState()
        .addFavVideoByBvids(fav.id, ['BV1Fail', 'BV1Fail:p2', 'BV1Fail:p3']);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(3);
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual([]);
    });

    it('混合多个 bvid：每个 bvid 仅 view 1 次，所有 trackId 各自写入', async () => {
      const fav = makeFav(FavListType.CUSTOM);
      const getVideoByBvid = vi.fn(async () => true);
      useBilibiliUserVideosStore.setState({ getVideoByBvid });

      await useFavListStore
        .getState()
        .addFavVideoByBvids(fav.id, ['BV1A', 'BV1A:p2', 'BV1B', 'BV1B:p3']);

      expect(getVideoByBvid).toHaveBeenCalledTimes(2);
      const after = useFavListStore.getState().list.find((f) => f.id === fav.id);
      expect(after?.bv_ids).toEqual(['BV1A', 'BV1A:p2', 'BV1B', 'BV1B:p3']);
    });

    it('entity 已缓存的 bvid 跳过 view 调用（合集场景预热后零请求）', async () => {
      const fav = makeFav(FavListType.CUSTOM);
      const getVideoByBvid = vi.fn(async () => true);
      useBilibiliUserVideosStore.setState({ getVideoByBvid });
      // 模拟合集 archives 已 upsert：BV_CACHED 缓存命中，BV_NEW 仍需 view
      useBilibiliVideosStore
        .getState()
        .upsertMany([{ bvid: 'BV_CACHED', created: 0 } as BilibiliVideo]);

      const result = await useFavListStore
        .getState()
        .addFavVideoByBvids(fav.id, ['BV_CACHED', 'BV_CACHED:p2', 'BV_NEW']);

      // 只对 BV_NEW 调一次 view；BV_CACHED 完全短路
      expect(getVideoByBvid).toHaveBeenCalledTimes(1);
      expect(getVideoByBvid).toHaveBeenCalledWith('BV_NEW', 1, 1);
      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('全部 bvid 命中缓存时 view 调用 0 次（解决 toast 抽搐 + 150 次 HTTP）', async () => {
      const fav = makeFav(FavListType.CUSTOM);
      const getVideoByBvid = vi.fn(async () => true);
      useBilibiliUserVideosStore.setState({ getVideoByBvid });
      useBilibiliVideosStore
        .getState()
        .upsertMany([
          { bvid: 'BV1', created: 0 } as BilibiliVideo,
          { bvid: 'BV2', created: 0 } as BilibiliVideo,
        ]);

      await useFavListStore.getState().addFavVideoByBvids(fav.id, ['BV1', 'BV2']);

      expect(getVideoByBvid).toHaveBeenCalledTimes(0);
    });
  });
});
