/**
 * playing-list store 行为测试
 * 覆盖：addSingle / setPlaylist / removeItem / clearPlaylist / updateCurrentPlaying /
 *       clearPlayNext / getNextIndex / getPrevIndex
 */
import { usePlayingListStore } from './playing-list';

function reset() {
  usePlayingListStore.setState({ favId: '', trackIds: [], current: '', playNext: false });
}

describe('usePlayingListStore', () => {
  beforeEach(reset);

  describe('addSingle', () => {
    it('追加新 trackId 到末尾', () => {
      usePlayingListStore.getState().addSingle('BV1');
      expect(usePlayingListStore.getState().trackIds).toEqual(['BV1']);
      expect(usePlayingListStore.getState().playNext).toBe(false);
    });

    it('已存在的 trackId 不重复追加', () => {
      usePlayingListStore.setState({ trackIds: ['BV1'] });
      usePlayingListStore.getState().addSingle('BV1');
      expect(usePlayingListStore.getState().trackIds).toEqual(['BV1']);
    });

    it('playNow=true 同步设置 current 与 playNext', () => {
      usePlayingListStore.getState().addSingle('BV2', true);
      const s = usePlayingListStore.getState();
      expect(s.current).toBe('BV2');
      expect(s.playNext).toBe(true);
    });
  });

  describe('setPlaylist', () => {
    it('设置完整播放列表，current 默认为首个 trackId', () => {
      usePlayingListStore.getState().setPlaylist('main', ['A', 'B', 'C']);
      const s = usePlayingListStore.getState();
      expect(s.favId).toBe('main');
      expect(s.trackIds).toEqual(['A', 'B', 'C']);
      expect(s.current).toBe('A');
      expect(s.playNext).toBe(false);
    });

    it('指定 current 时使用指定值', () => {
      usePlayingListStore.getState().setPlaylist('main', ['A', 'B'], 'B', true);
      const s = usePlayingListStore.getState();
      expect(s.current).toBe('B');
      expect(s.playNext).toBe(true);
    });

    it('空列表时 current 为空字符串', () => {
      usePlayingListStore.getState().setPlaylist('m', []);
      expect(usePlayingListStore.getState().current).toBe('');
    });
  });

  describe('removeItem', () => {
    it('删除非当前曲目：只移除，不切歌', () => {
      usePlayingListStore.setState({ trackIds: ['A', 'B', 'C'], current: 'A' });
      usePlayingListStore.getState().removeItem('B');
      const s = usePlayingListStore.getState();
      expect(s.trackIds).toEqual(['A', 'C']);
      expect(s.current).toBe('A');
      expect(s.playNext).toBe(false);
    });

    it('删除当前曲目：自动切到原位置（位置不变取下一个）', () => {
      usePlayingListStore.setState({ trackIds: ['A', 'B', 'C'], current: 'B' });
      usePlayingListStore.getState().removeItem('B');
      const s = usePlayingListStore.getState();
      expect(s.trackIds).toEqual(['A', 'C']);
      expect(s.current).toBe('C');
      expect(s.playNext).toBe(true);
    });

    it('删除最后一首当前曲目：current fallback 到末尾', () => {
      usePlayingListStore.setState({ trackIds: ['A', 'B'], current: 'B' });
      usePlayingListStore.getState().removeItem('B');
      const s = usePlayingListStore.getState();
      expect(s.current).toBe('A');
    });

    it('删空列表：current 为空字符串', () => {
      usePlayingListStore.setState({ trackIds: ['A'], current: 'A' });
      usePlayingListStore.getState().removeItem('A');
      const s = usePlayingListStore.getState();
      expect(s.trackIds).toEqual([]);
      expect(s.current).toBe('');
    });
  });

  describe('clearPlaylist', () => {
    it('清空所有字段', () => {
      usePlayingListStore.setState({
        favId: 'm',
        trackIds: ['A'],
        current: 'A',
        playNext: true,
      });
      usePlayingListStore.getState().clearPlaylist();
      expect(usePlayingListStore.getState()).toMatchObject({
        favId: '',
        trackIds: [],
        current: '',
        playNext: false,
      });
    });
  });

  describe('updateCurrentPlaying', () => {
    beforeEach(() => {
      usePlayingListStore.setState({ trackIds: ['A', 'B', 'C'], current: 'A' });
    });

    it('切到指定 index 并触发 playNext', () => {
      usePlayingListStore.getState().updateCurrentPlaying(2, true);
      const s = usePlayingListStore.getState();
      expect(s.current).toBe('C');
      expect(s.playNext).toBe(true);
    });

    it('切到相同 current 且 playNext=false 不触发更新', () => {
      const before = usePlayingListStore.getState();
      usePlayingListStore.getState().updateCurrentPlaying(0, false);
      const after = usePlayingListStore.getState();
      expect(after.current).toBe('A');
      expect(after.playNext).toBe(before.playNext);
    });

    it('越界 index：current 设为空', () => {
      usePlayingListStore.getState().updateCurrentPlaying(99);
      expect(usePlayingListStore.getState().current).toBe('');
    });
  });

  describe('clearPlayNext', () => {
    it('重置 playNext 信号', () => {
      usePlayingListStore.setState({ playNext: true });
      usePlayingListStore.getState().clearPlayNext();
      expect(usePlayingListStore.getState().playNext).toBe(false);
    });
  });

  describe('getNextIndex', () => {
    beforeEach(() => {
      usePlayingListStore.setState({ trackIds: ['A', 'B', 'C'], current: 'B' });
    });

    it('loop 模式：循环到下一首', () => {
      expect(usePlayingListStore.getState().getNextIndex('loop')).toBe(2);
    });

    it('loop 模式：末尾后回到首部', () => {
      usePlayingListStore.setState({ current: 'C' });
      expect(usePlayingListStore.getState().getNextIndex('loop')).toBe(0);
    });

    it('single 模式：返回当前 index 不切歌', () => {
      expect(usePlayingListStore.getState().getNextIndex('single')).toBe(1);
    });

    it('random 模式：返回 [0, length) 范围内的索引', () => {
      const idx = usePlayingListStore.getState().getNextIndex('random');
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    });

    it('once 模式：走顺序下一首（手动切歌不受"播完即停"约束）', () => {
      expect(usePlayingListStore.getState().getNextIndex('once')).toBe(2);
    });

    it('空列表：返回 -1', () => {
      usePlayingListStore.setState({ trackIds: [], current: '' });
      expect(usePlayingListStore.getState().getNextIndex('loop')).toBe(-1);
    });
  });

  describe('getPrevIndex', () => {
    beforeEach(() => {
      usePlayingListStore.setState({ trackIds: ['A', 'B', 'C'], current: 'B' });
    });

    it('loop 模式：上一首', () => {
      expect(usePlayingListStore.getState().getPrevIndex('loop')).toBe(0);
    });

    it('loop 模式：首部前回到末尾', () => {
      usePlayingListStore.setState({ current: 'A' });
      expect(usePlayingListStore.getState().getPrevIndex('loop')).toBe(2);
    });

    it('once 模式：走顺序上一首（手动切歌不受"播完即停"约束）', () => {
      expect(usePlayingListStore.getState().getPrevIndex('once')).toBe(0);
    });

    it('空列表：返回 -1', () => {
      usePlayingListStore.setState({ trackIds: [], current: '' });
      expect(usePlayingListStore.getState().getPrevIndex('loop')).toBe(-1);
    });
  });
});
