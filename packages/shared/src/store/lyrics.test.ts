import { useLyricsStore } from './lyrics';

function reset() {
  useLyricsStore.setState({ lyricMaps: {} });
}

describe('useLyricsStore', () => {
  beforeEach(reset);

  it('updateLyric 新增条目', () => {
    useLyricsStore.getState().updateLyric({
      bvid: 'BV1',
      lyricText: '[00:01.00]hello',
      offset: 0,
    });
    expect(useLyricsStore.getState().lyricMaps.BV1).toMatchObject({
      bvid: 'BV1',
      lyricText: '[00:01.00]hello',
      offset: 0,
    });
  });

  it('updateLyric 合并已有字段（保留未提供的字段）', () => {
    useLyricsStore.setState({
      lyricMaps: {
        BV1: { bvid: 'BV1', lyricText: 'old', offset: 100, cloudLyricId: 7 },
      },
    });
    useLyricsStore.getState().updateLyric({
      bvid: 'BV1',
      lyricText: 'new',
      offset: 200,
    });
    const entry = useLyricsStore.getState().lyricMaps.BV1;
    expect(entry.lyricText).toBe('new');
    expect(entry.offset).toBe(200);
    // cloudLyricId 未提供，保留
    expect(entry.cloudLyricId).toBe(7);
  });

  it('removeLyric 移除指定 bvid', () => {
    useLyricsStore.setState({
      lyricMaps: {
        BV1: { bvid: 'BV1', lyricText: '', offset: 0 },
        BV2: { bvid: 'BV2', lyricText: '', offset: 0 },
      },
    });
    useLyricsStore.getState().removeLyric('BV1');
    expect(useLyricsStore.getState().lyricMaps).not.toHaveProperty('BV1');
    expect(useLyricsStore.getState().lyricMaps).toHaveProperty('BV2');
  });

  it('removeLyric 移除不存在的 bvid 不抛错', () => {
    expect(() => useLyricsStore.getState().removeLyric('BVnotexist')).not.toThrow();
  });

  it('多个 bvid 互不影响', () => {
    useLyricsStore.getState().updateLyric({ bvid: 'A', lyricText: 'a', offset: 0 });
    useLyricsStore.getState().updateLyric({ bvid: 'B', lyricText: 'b', offset: 0 });
    expect(Object.keys(useLyricsStore.getState().lyricMaps)).toEqual(['A', 'B']);
  });
});
