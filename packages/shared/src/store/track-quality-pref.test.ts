import { useTrackQualityPrefStore } from './track-quality-pref';

beforeEach(() => {
  useTrackQualityPrefStore.setState({ quality: {} });
});

describe('track-quality-pref store', () => {
  it('setQuality 写入覆盖，getQuality 读取', () => {
    useTrackQualityPrefStore.getState().setQuality('BV1', 'hires');
    expect(useTrackQualityPrefStore.getState().getQuality('BV1')).toBe('hires');
  });

  it('未设覆盖的 bvid：getQuality 返回 undefined（跟随全局）', () => {
    expect(useTrackQualityPrefStore.getState().getQuality('BV_NONE')).toBeUndefined();
  });

  it('clearQuality 删除覆盖，恢复跟随全局', () => {
    useTrackQualityPrefStore.getState().setQuality('BV2', 'low');
    useTrackQualityPrefStore.getState().clearQuality('BV2');
    expect(useTrackQualityPrefStore.getState().getQuality('BV2')).toBeUndefined();
    expect('BV2' in useTrackQualityPrefStore.getState().quality).toBe(false);
  });

  it('setQuality 可存 auto（区别于"跟随全局"）', () => {
    useTrackQualityPrefStore.getState().setQuality('BV3', 'auto');
    expect(useTrackQualityPrefStore.getState().getQuality('BV3')).toBe('auto');
  });

  it('空 bvid 不写入', () => {
    useTrackQualityPrefStore.getState().setQuality('', 'high');
    expect(Object.keys(useTrackQualityPrefStore.getState().quality)).toHaveLength(0);
  });

  it('clearQuality 不存在的 bvid 不报错且不改变状态', () => {
    expect(() => useTrackQualityPrefStore.getState().clearQuality('BV_X')).not.toThrow();
    expect(Object.keys(useTrackQualityPrefStore.getState().quality)).toHaveLength(0);
  });
});
