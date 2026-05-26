import { useLiveSlicerCacheStore } from './live-slicer-cache';
import { timeStampNow } from '../utils';
import type { BilibiliUserCard, LiveSlicerCacheEntry, LiveSlicerMan } from '../types';

vi.mock('../api', async () => {
  return {
    UserApi: {
      getUserCard: vi.fn(),
    },
  };
});

const { UserApi } = await import('../api');
const mockedCard = UserApi.getUserCard as unknown as ReturnType<typeof vi.fn>;

const slicer = (mid: string, name = 'up'): LiveSlicerMan => ({
  id: Number(mid) || 0,
  mid,
  name,
  face: 'cloud-face',
  created_at: 0,
  updated_at: 0,
});

const card = (archiveCount: number, follower = 100): BilibiliUserCard => ({
  card: {
    mid: '1',
    name: 'card-name',
    face: 'card-face',
    sign: '',
    fans: follower,
    friend: 0,
    attention: 0,
  },
  follower,
  archive_count: archiveCount,
  like_num: 0,
});

const seedEntry = (overrides: Partial<LiveSlicerCacheEntry>): LiveSlicerCacheEntry => ({
  mid: '1',
  name: 'old',
  face: 'old-face',
  follower: 50,
  archiveCount: 10,
  lastFetchedAt: 0,
  lastUpdatedAt: 0,
  lastDelta: 0,
  hasUnread: false,
  ...overrides,
});

const refresh = (slicers: LiveSlicerMan[], opts?: { force?: boolean }) =>
  useLiveSlicerCacheStore.getState().refreshSlicers(slicers, opts);

beforeEach(() => {
  useLiveSlicerCacheStore.setState({ entries: {}, isRefreshing: false });
  mockedCard.mockReset();
});

describe('live-slicer-cache: persistSnapshot', () => {
  it('快照仅含 entries，不含 isRefreshing', () => {
    useLiveSlicerCacheStore.setState({ entries: { '1': seedEntry({}) }, isRefreshing: true });
    const snap = useLiveSlicerCacheStore.getState().persistSnapshot();
    expect(Object.keys(snap)).toEqual(['entries']);
    expect(snap.entries['1'].archiveCount).toBe(10);
  });
});

describe('live-slicer-cache: 投稿数差分判定', () => {
  it('首次刷新建基线：不标记更新（lastUpdatedAt=0, hasUnread=false）', async () => {
    mockedCard.mockResolvedValue(card(10, 200));
    await refresh([slicer('1')]);
    const entry = useLiveSlicerCacheStore.getState().entries['1'];
    expect(entry.archiveCount).toBe(10);
    expect(entry.follower).toBe(200);
    expect(entry.lastUpdatedAt).toBe(0);
    expect(entry.hasUnread).toBe(false);
    expect(entry.lastDelta).toBe(0);
    // name/face 取 card 最新值
    expect(entry.name).toBe('card-name');
    expect(entry.face).toBe('card-face');
  });

  it('投稿数增加：标记更新，记录新增数量与发现时刻', async () => {
    useLiveSlicerCacheStore.setState({ entries: { '1': seedEntry({ archiveCount: 10 }) } });
    mockedCard.mockResolvedValue(card(15));
    await refresh([slicer('1')]);
    const entry = useLiveSlicerCacheStore.getState().entries['1'];
    expect(entry.archiveCount).toBe(15);
    expect(entry.hasUnread).toBe(true);
    expect(entry.lastDelta).toBe(5);
    expect(entry.lastUpdatedAt).toBeGreaterThan(0);
  });

  it('投稿数减少（删稿）：仅刷新基线，不标记更新', async () => {
    useLiveSlicerCacheStore.setState({
      entries: { '1': seedEntry({ archiveCount: 10, lastUpdatedAt: 0, hasUnread: false }) },
    });
    mockedCard.mockResolvedValue(card(8));
    await refresh([slicer('1')]);
    const entry = useLiveSlicerCacheStore.getState().entries['1'];
    expect(entry.archiveCount).toBe(8);
    expect(entry.hasUnread).toBe(false);
    expect(entry.lastUpdatedAt).toBe(0);
  });

  it('投稿数不变：不标记更新', async () => {
    useLiveSlicerCacheStore.setState({ entries: { '1': seedEntry({ archiveCount: 10 }) } });
    mockedCard.mockResolvedValue(card(10));
    await refresh([slicer('1')]);
    const entry = useLiveSlicerCacheStore.getState().entries['1'];
    expect(entry.hasUnread).toBe(false);
    expect(entry.lastUpdatedAt).toBe(0);
  });
});

describe('live-slicer-cache: 刷新阈值与 force', () => {
  it('未过期不刷新（不调用接口）', async () => {
    useLiveSlicerCacheStore.setState({
      entries: { '1': seedEntry({ lastFetchedAt: timeStampNow() }) },
    });
    await refresh([slicer('1')]);
    expect(mockedCard).not.toHaveBeenCalled();
  });

  it('force=true 即使未过期也刷新', async () => {
    useLiveSlicerCacheStore.setState({
      entries: { '1': seedEntry({ lastFetchedAt: timeStampNow(), archiveCount: 10 }) },
    });
    mockedCard.mockResolvedValue(card(12));
    await refresh([slicer('1')], { force: true });
    expect(mockedCard).toHaveBeenCalledTimes(1);
    expect(useLiveSlicerCacheStore.getState().entries['1'].archiveCount).toBe(12);
  });
});

describe('live-slicer-cache: 容错与 markRead', () => {
  it('单条请求失败：保留旧缓存、不抛错、isRefreshing 复位', async () => {
    useLiveSlicerCacheStore.setState({ entries: { '1': seedEntry({ archiveCount: 10 }) } });
    mockedCard.mockRejectedValue(new Error('network'));
    await expect(refresh([slicer('1')])).resolves.toBeUndefined();
    const state = useLiveSlicerCacheStore.getState();
    expect(state.entries['1'].archiveCount).toBe(10);
    expect(state.isRefreshing).toBe(false);
  });

  it('markRead 清除未读标记', () => {
    useLiveSlicerCacheStore.setState({
      entries: { '1': seedEntry({ hasUnread: true, lastDelta: 3 }) },
    });
    useLiveSlicerCacheStore.getState().markRead('1');
    expect(useLiveSlicerCacheStore.getState().entries['1'].hasUnread).toBe(false);
  });
});
