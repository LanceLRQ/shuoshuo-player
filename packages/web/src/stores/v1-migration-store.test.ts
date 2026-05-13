/**
 * useV1MigrationStore 状态机测试
 *
 * 覆盖矩阵：6 个 action × 各自的源/目标状态 + 数据释放语义
 */
import type { ParsedImport } from '@shuoshuo-player/shared';
import { useV1MigrationStore } from './v1-migration-store';

const fakeRaw = { fav_list: { list: [] } };
const fakeParsed: ParsedImport = {
  version: '1',
  favList: [],
  lyricCount: 0,
  videoCount: 0,
  favoriteCount: 0,
  payload: {
    fav_list: { list: [] },
    lyrics: { lyricMaps: {} },
    bili_videos: { entities: {}, ids: [] },
    favorites: { entries: {} },
  },
};

beforeEach(() => {
  // 重置 store 到初始状态（zustand 不自带 reset，手动还原）
  useV1MigrationStore.setState({ status: 'idle', rawV1Data: null, parsed: null });
});

describe('useV1MigrationStore 状态流转', () => {
  it('初始状态：idle + 数据为 null', () => {
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('idle');
    expect(s.rawV1Data).toBeNull();
    expect(s.parsed).toBeNull();
  });

  it('setPending: idle → prompt（携带数据）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('prompt');
    expect(s.rawV1Data).toBe(fakeRaw);
    expect(s.parsed).toBe(fakeParsed);
  });

  it('startChoosing: prompt → choosing（数据保留）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    useV1MigrationStore.getState().startChoosing();
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('choosing');
    expect(s.rawV1Data).toBe(fakeRaw);
    expect(s.parsed).toBe(fakeParsed);
  });

  it('cancelChoosing: choosing → prompt（数据保留，可重新决策）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    useV1MigrationStore.getState().startChoosing();
    useV1MigrationStore.getState().cancelChoosing();
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('prompt');
    expect(s.rawV1Data).toBe(fakeRaw);
  });

  it('startDismissing: prompt → dismissing（数据保留，二次确认前可下载备份）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    useV1MigrationStore.getState().startDismissing();
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('dismissing');
    expect(s.rawV1Data).toBe(fakeRaw);
  });

  it('cancelDismissing: dismissing → prompt（数据保留）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    useV1MigrationStore.getState().startDismissing();
    useV1MigrationStore.getState().cancelDismissing();
    expect(useV1MigrationStore.getState().status).toBe('prompt');
  });

  it('postpone: 任意 → idle（释放数据，下次启动重新检测）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    useV1MigrationStore.getState().postpone();
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('idle');
    expect(s.rawV1Data).toBeNull();
    expect(s.parsed).toBeNull();
  });

  it('markCompleted: → completed（释放数据避免内存泄漏）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    useV1MigrationStore.getState().startChoosing();
    useV1MigrationStore.getState().markCompleted();
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('completed');
    expect(s.rawV1Data).toBeNull();
    expect(s.parsed).toBeNull();
  });

  it('markDismissed: → dismissed（释放数据）', () => {
    useV1MigrationStore.getState().setPending(fakeRaw, fakeParsed);
    useV1MigrationStore.getState().startDismissing();
    useV1MigrationStore.getState().markDismissed();
    const s = useV1MigrationStore.getState();
    expect(s.status).toBe('dismissed');
    expect(s.rawV1Data).toBeNull();
    expect(s.parsed).toBeNull();
  });
});
